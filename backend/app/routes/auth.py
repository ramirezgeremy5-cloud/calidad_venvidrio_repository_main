from fastapi import APIRouter, HTTPException, Depends, status, Header
from sqlalchemy import text
from datetime import datetime, timedelta
import logging
import uuid

from app.database.connection import engine
from app.dependencies.security import verify_password, create_access_token, hash_password
from app.dependencies.auth import get_current_user, get_current_active_user
from app.schemas.auth import LoginRequest, TokenResponse, RegisterRequest, PasswordChangeRequest, PasswordResetRequest

# Configurar logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Auth"])

# Tiempo de inactividad permitido antes de expirar la sesión (60 minutos = 1 hora)
TIEMPO_INACTIVIDAD_MINUTOS = 60


# =========================
# LOGIN
# =========================
@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest):
    """
    Iniciar sesión con correo y contraseña
    """
    logger.info(f"🔐 Intento de login para: {data.correo}")

    try:
        with engine.connect() as conn:
            logger.debug("📡 Buscando usuario en la base de datos...")

            # Consulta con JOIN para traer cargo y permisos
            user = conn.execute(
                text("""
                    SELECT u.id, u.nombre, u.correo, u.password, u.rol_id, u.activo,
                           COALESCE(u.intentos_fallidos, 0) as intentos_fallidos,
                           u.bloqueado_hasta,
                           u.session_id,
                           u.ultima_actividad,
                           c.nombre as cargo_nombre,
                           c.permisos as cargo_permisos
                    FROM usuarios u
                    LEFT JOIN cargos c ON u.cargo_id = c.id
                    WHERE u.correo = :correo
                """),
                {"correo": data.correo}
            ).mappings().first()

            # Usuario no existe
            if not user:
                logger.warning(f"❌ Usuario no encontrado: {data.correo}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Credenciales incorrectas"
                )

            logger.info(f"✅ Usuario encontrado: {user['nombre']} (ID: {user['id']})")

            # Verificar si el usuario está activo
            if not user["activo"]:
                logger.warning(f"⚠️ Usuario desactivado: {data.correo}")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Usuario desactivado. Contacte al administrador"
                )

            # =========================================================
            # 👇 CORRECCIÓN DEL ERROR: datetime vs str en bloqueado_hasta
            # =========================================================
            if user["bloqueado_hasta"]:
                valor_bloqueo = user["bloqueado_hasta"]
                
                # Si ya es un objeto datetime (PostgreSQL TIMESTAMP), lo usamos directo
                if isinstance(valor_bloqueo, datetime):
                    bloqueado_hasta = valor_bloqueo
                # Si por alguna razón viene como string, lo parseamos
                elif isinstance(valor_bloqueo, str):
                    try:
                        bloqueado_hasta = datetime.fromisoformat(valor_bloqueo)
                    except ValueError as e:
                        logger.error(f"❌ Error parseando fecha de bloqueo (string): {e}")
                        bloqueado_hasta = None
                else:
                    bloqueado_hasta = None

                if bloqueado_hasta and bloqueado_hasta > datetime.utcnow():
                    minutos_restantes = int((bloqueado_hasta - datetime.utcnow()).total_seconds() / 60)
                    logger.warning(f"🔒 Usuario bloqueado: {data.correo}")
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Usuario bloqueado. Intente en {minutos_restantes} minutos"
                    )

            # =========================================================
            # REEMPLAZAR SESIÓN ANTERIOR (SIN BLOQUEAR)
            # =========================================================
            if user["session_id"]:
                logger.info(f"♻️ Reemplazando sesión anterior para: {data.correo}")
                conn.execute(
                    text("UPDATE usuarios SET session_id = NULL, ultima_actividad = NULL WHERE id = :id"),
                    {"id": user["id"]}
                )
                conn.commit()

            # Verificar contraseña
            logger.debug("🔑 Verificando contraseña...")
            try:
                password_valid = verify_password(data.password, user["password"])
            except Exception as e:
                logger.error(f"❌ Error verificando contraseña: {e}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Error verificando contraseña: {str(e)}"
                )

            if not password_valid:
                intentos_actuales = user["intentos_fallidos"] or 0
                nuevos_intentos = intentos_actuales + 1
                logger.warning(f"❌ Contraseña incorrecta para {data.correo} - Intento {nuevos_intentos}/5")

                try:
                    if nuevos_intentos >= 5:
                        bloqueado_hasta = datetime.utcnow() + timedelta(minutes=30)
                        conn.execute(
                            text("""
                                UPDATE usuarios
                                SET intentos_fallidos = :intentos,
                                    bloqueado_hasta = :bloqueado
                                WHERE id = :id
                            """),
                            {
                                "intentos": nuevos_intentos,
                                "bloqueado": bloqueado_hasta,  # 👈 El driver acepta datetime nativo
                                "id": user["id"]
                            }
                        )
                        conn.commit()
                        logger.warning(f"🔒 Usuario bloqueado por 30 minutos: {data.correo}")
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="Demasiados intentos. Usuario bloqueado por 30 minutos"
                        )
                    else:
                        conn.execute(
                            text("""
                                UPDATE usuarios
                                SET intentos_fallidos = :intentos
                                WHERE id = :id
                            """),
                            {
                                "intentos": nuevos_intentos,
                                "id": user["id"]
                            }
                        )
                        conn.commit()
                except HTTPException:
                    raise
                except Exception as e:
                    logger.error(f"❌ Error actualizando intentos fallidos: {e}")

                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Credenciales incorrectas"
                )

            # ✅ Login exitoso - Resetear intentos fallidos
            logger.info(f"✅ Login exitoso para: {data.correo}")

            try:
                conn.execute(
                    text("""
                        UPDATE usuarios
                        SET intentos_fallidos = 0,
                            bloqueado_hasta = NULL,
                            ultimo_login = :now
                        WHERE id = :id
                    """),
                    {
                        "now": datetime.utcnow(),  # 👈 Objeto datetime nativo
                        "id": user["id"]
                    }
                )
                conn.commit()
            except Exception as e:
                logger.error(f"❌ Error actualizando último login: {e}")

            # Crear token JWT con session_id (sid) incluido
            try:
                nuevo_session_id = str(uuid.uuid4())
                token_data = {
                    "sub": str(user["id"]),
                    "correo": user["correo"],
                    "rol": user["rol_id"],
                    "sid": nuevo_session_id
                }
                access_token = create_access_token(token_data)
                logger.info(f"🔑 Token creado para usuario ID: {user['id']} (sid: {nuevo_session_id[:8]}...)")
            except Exception as e:
                logger.error(f"❌ Error creando token JWT: {e}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Error creando token: {str(e)}"
                )

            # ✅ GUARDAR LA SESIÓN EN LA BD (session_id + ultima_actividad)
            try:
                now_iso = datetime.utcnow()
                conn.execute(
                    text("""
                        UPDATE usuarios
                        SET session_id = :sid,
                            ultima_actividad = :now
                        WHERE id = :id
                    """),
                    {
                        "sid": nuevo_session_id,
                        "now": now_iso,  # 👈 Objeto datetime nativo
                        "id": user["id"]
                    }
                )
                conn.commit()
                logger.info(f"💾 Sesión guardada en BD para usuario ID: {user['id']}")
            except Exception as e:
                logger.error(f"❌ Error guardando session_id en BD: {e}")

            return {
                "access_token": access_token,
                "token_type": "bearer",
                "role": user["rol_id"],
                "user": {
                    "id": user["id"],
                    "nombre": user["nombre"],
                    "correo": user["correo"],
                    "rol_id": user["rol_id"],
                    "cargo": user["cargo_nombre"],
                    "permisos_cargo": user["cargo_permisos"]
                }
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"💥 Error inesperado en login: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error interno del servidor: {str(e)}"
        )


# =========================
# REGISTRO PÚBLICO
# =========================
@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(data: RegisterRequest):
    logger.info(f"📝 Registro de nuevo usuario: {data.correo}")

    try:
        with engine.connect() as conn:
            # Verificar si el correo ya existe
            existing = conn.execute(
                text("SELECT id FROM usuarios WHERE correo = :correo"),
                {"correo": data.correo}
            ).first()

            if existing:
                logger.warning(f"⚠️ Intento de registro con correo existente: {data.correo}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El correo ya está registrado"
                )

            try:
                password_hash = hash_password(data.password)
                logger.debug("🔑 Contraseña hasheada correctamente")
            except Exception as e:
                logger.error(f"❌ Error hasheando contraseña: {e}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Error hasheando contraseña: {str(e)}"
                )

            result = conn.execute(
                text("""
                    INSERT INTO usuarios (nombre, correo, password, rol_id, activo, creado_en, intentos_fallidos)
                    VALUES (:nombre, :correo, :password, :rol_id, :activo, :creado_en, :intentos_fallidos)
                    RETURNING id, nombre, correo, rol_id, activo, creado_en
                """),
                {
                    "nombre": data.nombre,
                    "correo": data.correo,
                    "password": password_hash,
                    "rol_id": data.rol_id or 1,
                    "activo": True,
                    "creado_en": datetime.utcnow(),  # 👈 datetime nativo
                    "intentos_fallidos": 0
                }
            ).mappings().first()

            conn.commit()
            logger.info(f"✅ Usuario registrado exitosamente: {data.correo} (ID: {result['id']})")

            return {
                "success": True,
                "message": "Usuario registrado exitosamente",
                "user": {
                    "id": result["id"],
                    "nombre": result["nombre"],
                    "correo": result["correo"],
                    "rol_id": result["rol_id"]
                }
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"💥 Error inesperado en registro: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error interno del servidor: {str(e)}"
        )


# =========================
# LOGOUT
# =========================
@router.post("/logout")
def logout(current_user = Depends(get_current_user)):
    try:
        logger.info(f"👋 Solicitud de logout para usuario ID: {current_user.id}")

        with engine.connect() as conn:
            conn.execute(
                text("""
                    UPDATE usuarios
                    SET session_id = NULL,
                        ultima_actividad = NULL
                    WHERE id = :id
                """),
                {"id": current_user.id}
            )
            conn.commit()

        logger.info(f"✅ Sesión liberada para usuario ID: {current_user.id}")
        return {
            "success": True,
            "message": "Sesión cerrada correctamente"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"💥 Error inesperado en logout: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error interno del servidor: {str(e)}"
        )


# =========================
# CAMBIAR CONTRASEÑA
# =========================
@router.post("/cambiar-password")
def cambiar_password(
    data: PasswordChangeRequest,
    current_user = Depends(get_current_user)
):
    logger.info(f"🔑 Cambio de contraseña para usuario ID: {current_user.id}")

    try:
        with engine.connect() as conn:
            user = conn.execute(
                text("SELECT password FROM usuarios WHERE id = :id"),
                {"id": current_user.id}
            ).first()

            if not user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Usuario no encontrado"
                )

            if not verify_password(data.current_password, user["password"]):
                logger.warning(f"❌ Contraseña actual incorrecta para usuario ID: {current_user.id}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Contraseña actual incorrecta"
                )

            new_password_hash = hash_password(data.new_password)
            conn.execute(
                text("""
                    UPDATE usuarios
                    SET password = :password
                    WHERE id = :id
                """),
                {
                    "password": new_password_hash,
                    "id": current_user.id
                }
            )
            conn.commit()

            logger.info(f"✅ Contraseña actualizada para usuario ID: {current_user.id}")
            return {
                "success": True,
                "message": "Contraseña actualizada exitosamente"
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"💥 Error inesperado en cambio de contraseña: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error interno del servidor: {str(e)}"
        )


# =========================
# VERIFICAR TOKEN (HEARTBEAT)
# =========================
@router.get("/verify")
def verify_token(current_user = Depends(get_current_user)):
    logger.info(f"✅ Token verificado para usuario ID: {current_user.id}")
    
    try:
        with engine.connect() as conn:
            conn.execute(
                text("""
                    UPDATE usuarios
                    SET ultima_actividad = :now
                    WHERE id = :id
                """),
                {
                    "now": datetime.utcnow(),  # 👈 datetime nativo
                    "id": current_user.id
                }
            )
            conn.commit()
    except Exception as e:
        logger.error(f"Error actualizando ultima_actividad en verify: {e}")

    return {
        "success": True,
        "user": {
            "id": current_user.id,
            "nombre": current_user.nombre,
            "correo": current_user.correo,
            "rol_id": current_user.rol_id
        }
    }


# =========================
# ENDPOINT DE PRUEBA
# =========================
@router.get("/test")
def test_endpoint():
    return {
        "success": True,
        "message": "Auth router funcionando correctamente"
    }


# =========================
# ENDPOINT DE PRUEBA DE CONEXIÓN
# =========================
@router.post("/test-login")
def test_login(data: LoginRequest):
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1 as test")).mappings().first()

            user = conn.execute(
                text("""
                    SELECT id, nombre, correo, rol_id, activo,
                           session_id, ultima_actividad
                    FROM usuarios WHERE correo = :correo
                """),
                {"correo": data.correo}
            ).mappings().first()

            return {
                "success": True,
                "db_connection": "ok",
                "user_found": bool(user),
                "user": dict(user) if user else None,
                "message": "Endpoint de prueba funcionando"
            }
    except Exception as e:
        import traceback
        return {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }
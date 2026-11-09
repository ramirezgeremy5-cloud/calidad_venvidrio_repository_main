from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy import text
from datetime import datetime, timedelta
import logging
import requests # 👈 IMPORTANTE: Librería para validar con Google

from app.database.connection import engine
from app.dependencies.security import verify_password, create_access_token, hash_password
from app.dependencies.auth import get_current_user, get_current_active_user
from app.schemas.auth import LoginRequest, TokenResponse, RegisterRequest, PasswordChangeRequest, PasswordResetRequest

# Configurar logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Auth"])

# 👇 NUEVA CLAVE SECRETA DE GOOGLE RECAPTCHA 👇
RECAPTCHA_SECRET_KEY = "6Ld5dhcuAAAAAF0u_rfSAEq9Pe-P73Nfv7xWEOM"


# =========================
# FUNCIÓN AUXILIAR PARA VALIDAR CAPTCHA
# =========================
def validar_captcha(token: str) -> bool:
    """Verifica con los servidores de Google si el token del CAPTCHA es válido."""
    try:
        response = requests.post(
            "https://www.google.com/recaptcha/api/siteverify",
            data={"secret": RECAPTCHA_SECRET_KEY, "response": token},
            timeout=5
        )
        result = response.json()
        return result.get("success", False)
    except Exception as e:
        logger.error(f"Error validando CAPTCHA con Google: {e}")
        return False


# =========================
# LOGIN (MULTISESIÓN + CAPTCHA)
# =========================
@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest):
    """
    Iniciar sesión con correo y contraseña.
    Permite múltiples sesiones simultáneas (PC + Móvil).
    """
    logger.info(f"🔐 Intento de login para: {data.correo}")

    # 👇 1. VALIDACIÓN DEL CAPTCHA 👇
    if data.captcha_token:
        if not validar_captcha(data.captcha_token):
            logger.warning(f"❌ CAPTCHA inválido para: {data.correo}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="CAPTCHA inválido o expirado. Intenta de nuevo."
            )
        logger.info(f"✅ CAPTCHA válido para: {data.correo}")
    else:
        logger.debug(f"ℹ️ Login sin CAPTCHA (dispositivo recordado): {data.correo}")

    try:
        with engine.connect() as conn:
            logger.debug("📡 Buscando usuario en la base de datos...")

            user = conn.execute(
                text("""
                    SELECT u.id, u.nombre, u.correo, u.password, u.rol_id, u.activo,
                           COALESCE(u.intentos_fallidos, 0) as intentos_fallidos,
                           u.bloqueado_hasta,
                           c.nombre as cargo_nombre,
                           c.permisos as cargo_permisos
                    FROM usuarios u
                    LEFT JOIN cargos c ON u.cargo_id = c.id
                    WHERE u.correo = :correo
                """),
                {"correo": data.correo}
            ).mappings().first()

            if not user:
                logger.warning(f"❌ Usuario no encontrado: {data.correo}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Credenciales incorrectas"
                )

            logger.info(f"✅ Usuario encontrado: {user['nombre']} (ID: {user['id']})")

            if not user["activo"]:
                logger.warning(f"⚠️ Usuario desactivado: {data.correo}")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Usuario desactivado. Contacte al administrador"
                )

            # Manejo del bloqueo por intentos fallidos
            if user["bloqueado_hasta"]:
                valor_bloqueo = user["bloqueado_hasta"]
                
                if isinstance(valor_bloqueo, datetime):
                    bloqueado_hasta = valor_bloqueo
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
                                "bloqueado": bloqueado_hasta,
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

            # ✅ Login exitoso
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
                        "now": datetime.utcnow(),
                        "id": user["id"]
                    }
                )
                conn.commit()
            except Exception as e:
                logger.error(f"❌ Error actualizando último login: {e}")

            # Crear token JWT
            try:
                token_data = {
                    "sub": str(user["id"]),
                    "correo": user["correo"],
                    "rol": user["rol_id"]
                }
                access_token = create_access_token(token_data)
                logger.info(f"🔑 Token creado para usuario ID: {user['id']}")
            except Exception as e:
                logger.error(f"❌ Error creando token JWT: {e}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Error creando token: {str(e)}"
                )

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
                    "creado_en": datetime.utcnow(),
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
        return {
            "success": True,
            "message": "Sesión cerrada correctamente"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"💥 Error inesperado en logout: {str(e)}")
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
                    "now": datetime.utcnow(),
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
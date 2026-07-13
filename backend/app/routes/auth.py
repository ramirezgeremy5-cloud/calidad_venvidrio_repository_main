from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from app.database.connection import engine
from app.core.security import verify_password, create_access_token
from app.schemas.auth import LoginRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["Auth"])


# =========================
# LOGIN
# =========================
@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest):

    with engine.connect() as conn:

        user = conn.execute(
            text("""
                SELECT id, nombre, correo, password, rol_id
                FROM usuarios
                WHERE correo = :correo
            """),
            {"correo": data.correo}
        ).mappings().first()

        # Usuario no existe
        if not user:
            raise HTTPException(
                status_code=401,
                detail="Usuario no encontrado"
            )

        # Contraseña incorrecta
        if not verify_password(data.password, user["password"]):
            raise HTTPException(
                status_code=401,
                detail="Contraseña incorrecta"
            )

        # Crear JWT
        token = create_access_token({
    "sub": str(user["id"]),
    "role": user["rol_id"]

        })
        

        return {
            "access_token": token,
            "token_type": "bearer",
            "role": user["rol_id"],
            "user": {
                "id": user["id"],
                "nombre": user["nombre"],
                "correo": user["correo"],
                "rol_id": user["rol_id"]
            }
        }
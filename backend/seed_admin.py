"""
Script para crear el usuario Administrador inicial.
Ejecutar solo una vez desde la terminal: python seed_admin.py
"""

from datetime import datetime

# 1. Importamos la Base y el motor
from app.database.connection import Base, engine, SessionLocal

# 2. Importamos el modelo de Cargo y Usuario
# ⚠️ CRÍTICO: Importar los modelos en el orden correcto
from app.models.cargo import Cargo  
from app.models.usuario import Usuario
from app.dependencies.security import hash_password

def crear_admin_inicial():
    # 🔥 ESTA ES LA SOLUCIÓN:
    # Esto le dice a SQLAlchemy que revise todos los modelos importados
    # y configure las relaciones (como Usuario -> Cargo) antes de hacer consultas.
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # Verificar si ya existe algún administrador en el sistema
        admin_existente = db.query(Usuario).filter(Usuario.rol_id == 3).first()
        
        if admin_existente:
            print(f"\n⚠️  Ya existe un administrador registrado: {admin_existente.correo}")
            print("   El script no creará un duplicado. Operación cancelada.\n")
            return

        # Datos por defecto del Administrador
        correo_admin = "admin@venvidrio.com"
        password_plana = "Venvidrio2026!" 
        nombre_admin = "Administrador Principal"

        print("⏳ Creando usuario Administrador inicial...")

        nuevo_admin = Usuario(
            nombre=nombre_admin,
            correo=correo_admin,
            password=hash_password(password_plana),
            rol_id=3,          # 3 = Administrador
            activo=True,
            creado_en=datetime.utcnow(),
            turno="A",         # Campo obligatorio
            cedula=None,       
            fecha_ingreso=None,
            foto_url=None
        )

        db.add(nuevo_admin)
        db.commit()

        print("\n" + "=" * 55)
        print("✅ Administrador creado exitosamente.")
        print("=" * 55)
        print("🔑 CREDENCIALES DE ACCESO:")
        print(f"   Usuario:    admin")
        print(f"   Correo:     {correo_admin}")
        print(f"   Contraseña: {password_plana}")
        print("=" * 55)
        print("⚠️  IMPORTANTE:")
        print("   1. Inicia sesión con estas credenciales.")
        print("   2. Ve a la sección 'Usuarios' y edita tu perfil")
        print("      para actualizar tu nombre, cédula, foto y contraseña.")
        print("=" * 55 + "\n")

    except Exception as e:
        db.rollback()
        print(f"\n❌ Error al crear el admin: {e}\n")
    finally:
        db.close()

if __name__ == "__main__":
    print("\n🐉 MoonDRAGO - Inicializador de Base de Datos\n")
    crear_admin_inicial()
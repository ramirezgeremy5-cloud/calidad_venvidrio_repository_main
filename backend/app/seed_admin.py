"""
Script para crear el usuario Administrador inicial.
Ejecutar solo una vez desde la terminal: python seed_admin.py
"""

from app.database.connection import SessionLocal
from app.dependencies.security import hash_password
from datetime import datetime

# ==========================================
# IMPORTACIÓN DE TODOS LOS MODELOS
# (Necesario para que SQLAlchemy resuelva las relaciones)
# ==========================================
from app.models.usuario import Usuario
from app.models.cargo import Cargo
from app.models.auditoria_calidad import AuditoriaCalidad
# Si tienes otros modelos relacionados, agrégalos aquí abajo:
# from app.models.cliente import Cliente
# from app.models.producto import Producto
# etc...

def crear_admin_inicial():
    db = SessionLocal()
    try:
        # 1. Verificar si ya existe algún administrador en el sistema
        admin_existente = db.query(Usuario).filter(Usuario.rol_id == 3).first()
        
        if admin_existente:
            print(f"\n⚠️  Ya existe un administrador registrado: {admin_existente.correo}")
            print("   El script no creará un duplicado. Operación cancelada.\n")
            return

        # 2. Datos por defecto del Administrador
        # (En el login solo tendrás que escribir "admin")
        correo_admin = "admin@venvidrio.com"
        password_plana = "Venvidrio2026!" 
        nombre_admin = "Administrador Principal"

        print("⏳ Creando usuario Administrador inicial...")

        # 3. Crear el usuario en la base de datos
        nuevo_admin = Usuario(
            nombre=nombre_admin,
            correo=correo_admin,
            password=hash_password(password_plana),
            rol_id=3,          # 3 = Administrador
            activo=True,
            creado_en=datetime.utcnow(),
            turno="A",         # Campo obligatorio según tu nuevo esquema
            cedula=None,       # Lo puedes llenar luego desde la interfaz
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
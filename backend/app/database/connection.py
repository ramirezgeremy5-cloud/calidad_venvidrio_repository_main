from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv
from pathlib import Path
import psycopg2
import os

Base = declarative_base()

BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")

# 1. Intentamos obtener la URL completa (para Producción/Render)
DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    print("✅ Usando DATABASE_URL de producción (Render)")
else:
    # 2. Si no existe, usamos la lógica local (para tu PC)
    print("========== CONFIG LOCAL ==========")
    print("HOST:", os.getenv("DB_HOST"))
    print("PORT:", os.getenv("DB_PORT"))
    print("DB:", os.getenv("DB_NAME"))
    print("USER:", os.getenv("DB_USER"))
    print("PASSWORD:", os.getenv("DB_PASSWORD"))
    print("==================================")

    # Prueba de conexión directa (solo para local)
    try:
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            database=os.getenv("DB_NAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
        )
        print("✅ Conexión directa exitosa")
        conn.close()
    except Exception as e:
        print("❌ Error de conexión directa:")
        print(repr(e))
        raise

    # Construcción de la URL para local
    DATABASE_URL = (
        f"postgresql://{os.getenv('DB_USER')}:"
        f"{os.getenv('DB_PASSWORD')}@"
        f"{os.getenv('DB_HOST')}:"
        f"{os.getenv('DB_PORT')}/"
        f"{os.getenv('DB_NAME')}"
    )

print("URL de conexión final configurada.")

engine = create_engine(
    DATABASE_URL,
    echo=True
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

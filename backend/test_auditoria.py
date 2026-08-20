# test_auditoria.py
from app.routes import auditoria_producto
from fastapi import FastAPI

app = FastAPI()
app.include_router(auditoria_producto.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
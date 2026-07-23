from pydantic import BaseModel
from datetime import datetime



class EtiquetaBase(BaseModel):

    codigo_lote:str

    producto:str

    dimensiones:str

    espesor:str

    cantidad:int

    cliente:str

    norma:str | None = None

    estado:str

    qr_codigo:str | None = None





class EtiquetaCreate(EtiquetaBase):

    pass






class EtiquetaResponse(EtiquetaBase):

    id:int

    fecha_registro:datetime



    class Config:

        from_attributes=True
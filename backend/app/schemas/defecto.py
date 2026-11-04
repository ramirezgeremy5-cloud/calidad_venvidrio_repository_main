from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional, Literal, List


# ==========================================
# CLASIFICACIONES OFICIALES (Según Glosario Venvidrio)
# ==========================================
ClasificacionOficial = Literal["Crítico", "Mayor B+", "Mayor B-", "Menor"]

# ==========================================
# RESULTADO DEL LOTE (para el campo resultado_lote)
# ==========================================
ResultadoLote = Literal["APTO", "RETENIDO"]


# ==========================================
# SCHEMA BASE (compartido entre Create/Response)
# ==========================================
class DefectoBase(BaseModel):
    codigo_lote: str = Field(
        ...,
        description="Código del lote vinculado (debe existir en Producción)",
        min_length=1,
        max_length=30
    )

    tipo_defecto: str = Field(
        ...,
        description="Tipo específico del defecto (ej: Cuello Torcido, Marca de Hombro)",
        min_length=1,
        max_length=100
    )

    clasificacion: ClasificacionOficial = Field(
        ...,
        description="Clasificación oficial: Crítico, Mayor B+, Mayor B-, Menor"
    )

    cantidad_piezas: int = Field(
        ...,
        description="Cantidad de piezas afectadas",
        ge=0
    )

    zona_deteccion: Optional[str] = Field(
        None,
        description="Zona física donde se detectó (Formación, Zona Fría, etc.)",
        max_length=100
    )

    inspector: str = Field(
        ...,
        description="Nombre del inspector responsable",
        min_length=1,
        max_length=100
    )

    descripcion: Optional[str] = Field(
        None,
        description="Notas adicionales sobre el defecto"
    )

    @field_validator("tipo_defecto", "inspector", mode="before")
    @classmethod
    def limpiar_espacios(cls, v: str) -> str:
        """Elimina espacios al inicio y al final de strings clave."""
        if isinstance(v, str):
            return v.strip()
        return v


# ==========================================
# SCHEMA PARA CREAR (POST /defectos/)
# Incluye campos extra que actualizan el lote de producción
# ==========================================
class DefectoCreate(DefectoBase):
    lote_id: Optional[int] = Field(None, description="ID interno del lote en producción")
    
    # 👇 NUEVO: Identificador para agrupar los defectos
    grupo_id: Optional[str] = Field(
        None, 
        description="ID único para agrupar varios defectos que afectan a la misma cantidad de piezas",
        max_length=100
    )
    
    observaciones: Optional[str] = Field(
        None,
        description="Observaciones generales de la evaluación (se guardan en el lote y en el defecto)"
    )

    resultado_lote: Optional[ResultadoLote] = Field(
        None,
        description="Resultado final del lote. Si se omite, se asume 'RETENIDO' al crear un defecto."
    )

    # 👇 CAMPOS DE MUESTRA ACTUALIZADOS
    tamano_muestra: Optional[int] = Field(None, description="Cantidad de botellas inspeccionadas (n)")
    canastas_inspeccionadas: Optional[int] = Field(None, description="Cantidad de canastas revisadas")
    tamano_poblacion: Optional[int] = Field(None, description="Población total del lote (N)")
    botellas_por_caja: Optional[int] = Field(None, description="Botellas por camada/caja")
    botellas_por_paleta: Optional[int] = Field(None, description="Botellas por paleta")
    gruesas_por_paleta: Optional[int] = Field(None, description="Gruesas por paleta")


# ==========================================
# SCHEMA PARA ACTUALIZAR (PUT /defectos/{id})
# Todos los campos opcionales
# ==========================================
class DefectoUpdate(BaseModel):
    tipo_defecto: Optional[str] = Field(None, min_length=1, max_length=100)
    clasificacion: Optional[ClasificacionOficial] = None
    cantidad_piezas: Optional[int] = Field(None, ge=0)
    zona_deteccion: Optional[str] = Field(None, max_length=100)
    inspector: Optional[str] = Field(None, min_length=1, max_length=100)
    descripcion: Optional[str] = None
    resultado_lote: Optional[ResultadoLote] = None
    validado: Optional[bool] = None
    notas_internas: Optional[str] = None
    observaciones: Optional[str] = None
    grupo_id: Optional[str] = None
    
    tamano_muestra: Optional[int] = None
    canastas_inspeccionadas: Optional[int] = None
    tamano_poblacion: Optional[int] = None
    botellas_por_caja: Optional[int] = None
    botellas_por_paleta: Optional[int] = None
    gruesas_por_paleta: Optional[int] = None


# ==========================================
# SCHEMA DE RESPUESTA (GET /defectos/)
# Incluye todos los campos del modelo Defecto
# ==========================================
class DefectoResponse(DefectoBase):
    id: int
    lote_id: Optional[int] = Field(None, description="FK al lote de producción")
    
    # 👇 NUEVO
    grupo_id: Optional[str] = None
    
    resultado_lote: Optional[ResultadoLote] = None
    origen: Optional[str] = "manual"
    validado: Optional[bool] = True
    notas_internas: Optional[str] = None
    observaciones: Optional[str] = None 
    
    tamano_muestra: Optional[int] = None
    canastas_inspeccionadas: Optional[int] = None
    tamano_poblacion: Optional[int] = None
    botellas_por_caja: Optional[int] = None
    botellas_por_paleta: Optional[int] = None
    gruesas_por_paleta: Optional[int] = None
    
    fecha_registro: datetime
    fecha_actualizacion: datetime

    class Config:
        from_attributes = True


# ==========================================
# SCHEMA PARA MARCAR LOTE COMO APTO
# (POST /defectos/lote/{lote_id}/apto)
# ==========================================
class MarcarLoteAptoRequest(BaseModel):
    observaciones: Optional[str] = Field(
        None,
        description="Observaciones a guardar en el lote. Si se omite, se mantienen las de producción."
    )
    
    tamano_muestra: Optional[int] = Field(None, description="Cantidad de botellas inspeccionadas")
    canastas_inspeccionadas: Optional[int] = Field(None, description="Cantidad de canastas revisadas")


# ==========================================
# SCHEMA PARA MARCAR LOTE COMO RETENIDO
# (POST /defectos/lote/{lote_id}/retenido)
# ==========================================
class MarcarLoteRetenidoRequest(BaseModel):
    observaciones: str = Field(
        ...,
        description="Observaciones obligatorias al retener un lote (defectos encontrados)",
        min_length=1
    )


# ==========================================
# SCHEMAS PARA LA TABLA MAESTRA DE TIPOS DE DEFECTO
# ==========================================
class DefectoTipoBase(BaseModel):
    clasificacion: ClasificacionOficial = Field(
        ...,
        description="Clasificación a la que pertenece el tipo de defecto"
    )
    nombre: str = Field(
        ...,
        description="Nombre del tipo de defecto (ej: Boca deformada, Crajón)",
        min_length=1,
        max_length=150
    )
    activo: Optional[bool] = True

class TipoDefectoCreate(BaseModel):
    """
    Lo que envía el frontend al crear un tipo nuevo.
    """
    clasificacion: ClasificacionOficial = Field(
        ...,
        description="Clasificación a la que pertenece el tipo de defecto"
    )
    tipo_defecto: str = Field(
        ...,
        description="Nombre del tipo de defecto (ej: Boca deformada, Crajón)",
        min_length=1,
        max_length=100
    )

class DefectoTipoResponse(DefectoTipoBase):
    id: int
    fecha_creacion: datetime

    class Config:
        from_attributes = True


# ==========================================
# SCHEMA DE RESPUESTA DE ESTADÍSTICAS
# (GET /defectos/estadisticas)
# ==========================================
class EstadisticasResponse(BaseModel):
    total: int
    criticos: int
    mayores_bplus: int
    mayores_bminus: int
    menores: int


# ==========================================
# SCHEMA DE OPCIONES REGISTRADAS (Datalists)
# (GET /defectos/opciones)
# ==========================================
class OpcionesResponse(BaseModel):
    tipos: list[str]
    zonas: list[str]
    inspectores: list[str]
    clasificaciones: list[str]


# ==========================================
# SCHEMA DE RESPUESTA DE LOTE ACTUALIZADO
# (POST /defectos/lote/{id}/apto | /retenido)
# ==========================================
class LoteActualizadoResponse(BaseModel):
    mensaje: str
    lote_id: int
    codigo_lote: str
    estatus: str
    observaciones: Optional[str] = None
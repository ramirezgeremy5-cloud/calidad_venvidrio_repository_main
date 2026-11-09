/* =============================================
   VENVIDRIO - EXPORTADOR GLOBAL (WORD / EXCEL / PDF)
   exportar.js - Conectado al backend de reportes
   ============================================= */
(function () {
  'use strict';

  // Detectar la URL del servidor
  var API_URL;
  if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
    API_URL = "http://127.0.0.1:8000";
  } else {
    API_URL = "https://calidad-venvidrio-repository-main.onrender.com";
  }

  // Función interna para manejar la descarga y el token
  async function descargarArchivo(endpoint, nombreArchivo) {
    var token = localStorage.getItem('token');
    if (!token) {
      alert('Sesión expirada. Por favor, inicia sesión de nuevo.');
      return;
    }

    try {
      // Mostramos un aviso de carga (puedes cambiarlo por un spinner en el botón si prefieres)
      console.log('Generando archivo desde: ' + endpoint);

      var res = await fetch(API_URL + endpoint, {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + token }
      });

      if (!res.ok) {
        var errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Error al generar el archivo');
      }

      // Convertimos la respuesta a un Blob (archivo binario)
      var blob = await res.blob();
      
      // Creamos un enlace temporal para forzar la descarga
      var url = window.URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = nombreArchivo;
      document.body.appendChild(a);
      a.click();
      a.remove();
      
      // Limpiamos la memoria
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Error de exportación:', error);
      alert('No se pudo generar el archivo: ' + error.message);
    }
  }

  // ==========================================
  // 1. EXPORTACIONES DEL DASHBOARD
  // ==========================================
  
  // Ojo: Esta ruta no está en tu archivo de defectos, asumo que la tienes en dashboard.py
  window.exportarDashboardWord = function () {
    descargarArchivo('/dashboard/exportar/word', 'Reporte_Dashboard.docx');
  };

  // ==========================================
  // 2. EXPORTACIONES DE LA PÁGINA DEFECTOS (General)
  // ==========================================

  // Exporta a Excel (Historial de Defectos)
  window.exportarDefectosExcel = function () {
    descargarArchivo('/reportes/defectos/excel', 'Historial_Defectos.xlsx');
  };

  // Exporta a PDF (Historial de Defectos)
  window.exportarDefectosPDF = function () {
    descargarArchivo('/reportes/defectos/pdf', 'Historial_Defectos.pdf');
  };

  // Exporta a Word (Historial de Defectos)
  window.exportarDefectosWord = function () {
    descargarArchivo('/reportes/defectos/word', 'Historial_Defectos.docx');
  };

  // ==========================================
  // 3. EXPORTACIONES INDIVIDUALES (Desde la tabla o modal)
  // ==========================================

  // Exporta un solo defecto en Word (Formato Sábana/Inspección)
  window.exportarInspeccionWord = function (defectoId) {
    descargarArchivo(`/reportes/defectos/individual/word/${defectoId}`, `Inspeccion_${defectoId}.docx`);
  };

  // Exporta un solo defecto en PDF (Formato Sábana/Inspección)
  window.exportarInspeccionPDF = function (defectoId) {
    descargarArchivo(`/reportes/defectos/individual/pdf/${defectoId}`, `Inspeccion_${defectoId}.pdf`);
  };

  // ==========================================
  // 4. EXPORTACIONES DE LA SÁBANA (Agrupado por Cliente)
  // ==========================================

  // Exporta la sábana entera a Excel
  window.exportarSabanaExcel = function (mes, cliente) {
    var query = [];
    if (mes) query.push(`mes=${encodeURIComponent(mes)}`);
    if (cliente) query.push(`cliente=${encodeURIComponent(cliente)}`);
    var paramStr = query.length > 0 ? '?' + query.join('&') : '';
    
    descargarArchivo(`/reportes/defectos/sabana/excel${paramStr}`, `Sabana_Clientes.xlsx`);
  };

  // Exporta la sábana entera a Word
  window.exportarSabanaWord = function (mes, cliente) {
    var query = [];
    if (mes) query.push(`mes=${encodeURIComponent(mes)}`);
    if (cliente) query.push(`cliente=${encodeURIComponent(cliente)}`);
    var paramStr = query.length > 0 ? '?' + query.join('&') : '';
    
    descargarArchivo(`/reportes/defectos/sabana/word${paramStr}`, `Sabana_Clientes.docx`);
  };

  // Exporta la sábana entera a PDF
  window.exportarSabanaPDF = function (mes, cliente) {
    var query = [];
    if (mes) query.push(`mes=${encodeURIComponent(mes)}`);
    if (cliente) query.push(`cliente=${encodeURIComponent(cliente)}`);
    var paramStr = query.length > 0 ? '?' + query.join('&') : '';
    
    descargarArchivo(`/reportes/defectos/sabana/pdf${paramStr}`, `Sabana_Clientes.pdf`);
  };

})();
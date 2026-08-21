/* ==========================================
   VENVIDRIO - DEFECTOS
   defectos.js
========================================== */


(function(){

"use strict";
/* ==========================================
   CONTROL DE SESIÓN - USUARIO
========================================== */

function cargarUsuarioNav() {
  const userData = localStorage.getItem('user');
  if (userData) {
    try {
      const user = JSON.parse(userData);
      const avatar = document.getElementById('navAvatar');
      const username = document.getElementById('navUsername');
      const dropdownAvatar = document.getElementById('dropdownAvatar');
      const dropdownName = document.getElementById('dropdownName');
      const dropdownEmail = document.getElementById('dropdownEmail');

      const iniciales = user.nombre ? user.nombre.substring(0, 2).toUpperCase() : 'US';
      const nombre = user.nombre || 'Usuario';
      const correo = user.correo || 'usuario@email.com';

      if (avatar) avatar.textContent = iniciales;
      if (username) username.textContent = nombre;
      if (dropdownAvatar) dropdownAvatar.textContent = iniciales;
      if (dropdownName) dropdownName.textContent = nombre;
      if (dropdownEmail) dropdownEmail.textContent = correo;
    } catch (e) {
      console.error('Error cargando usuario:', e);
    }
  }
}

function verificarSesion() {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '../public/login.html';
    return;
  }

  fetch(`${API_URL}/auth/verify`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Token inválido');
    }
    return response.json();
  })
  .then(() => {
    cargarUsuarioNav();
    initUserControls();
    cargarDefectos();
  })
  .catch(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('role');
    window.location.href = '../public/login.html';
  });
}

function cerrarSesion(mensaje) {
  const token = localStorage.getItem('token');
  
  if (token) {
    fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    .catch(() => {})
    .finally(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('role');
      if (mensaje) alert(mensaje);
      window.location.href = '../public/login.html';
    });
  } else {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('role');
    if (mensaje) alert(mensaje);
    window.location.href = '../public/login.html';
  }
}

function toggleDropdown() {
  const dropdown = document.getElementById('userDropdown');
  if (dropdown) {
    dropdown.classList.toggle('show');
  }
}

function cerrarDropdown() {
  const dropdown = document.getElementById('userDropdown');
  if (dropdown) {
    dropdown.classList.remove('show');
  }
}

function initUserControls() {
  const container = document.getElementById('navUserContainer');
  const logoutBtn = document.getElementById('dropdownLogout');

  if (container) {
    container.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleDropdown();
    });
  }

  document.addEventListener('click', function() {
    cerrarDropdown();
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      cerrarDropdown();
    }
    if (e.ctrlKey && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
      e.preventDefault();
      if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
        cerrarSesion('👋 Sesión cerrada exitosamente.');
      }
    }
  });

  if (logoutBtn) {
    logoutBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
        cerrarSesion('👋 Sesión cerrada exitosamente.');
      }
    });
  }
}


const API_URL =
"http://127.0.0.1:8000";


let defectos = [];






/* ==========================================
   CARGAR DEFECTOS
========================================== */


async function cargarDefectos(){


try{


const response =
await fetch(
`${API_URL}/defectos/`
);



if(!response.ok){

throw new Error(
"Error cargando defectos"
);

}



const data =
await response.json();



defectos =
data.map(d=>({


id:d.id,

lote:
d.codigo_lote,


tipo:
d.tipo_defecto,


clase:
d.clasificacion,


piezas:
d.cantidad_piezas,


zona:
d.zona_deteccion,


inspector:
d.inspector,


descripcion:
d.descripcion,


fecha:
new Date(
d.fecha_registro
).toLocaleDateString(),


hora:
new Date(
d.fecha_registro
).toLocaleTimeString(
[],
{
hour:"2-digit",
minute:"2-digit"
}
)


}));



actualizarStats();

renderTabla();

renderDist();

renderTop();



}
catch(error){


console.error(
"Error cargando defectos:",
error
);


}



}








/* ==========================================
   ESTADÍSTICAS
========================================== */


function actualizarStats(){



const total =
defectos.length;



const criticos =
defectos.filter(
d=>d.clase==="Crítico"
).length;



const mayores =
defectos.filter(
d=>d.clase==="Mayor"
).length;



const menores =
defectos.filter(
d=>d.clase==="Menor"
).length;




document.getElementById(
"total-defectos"
).textContent =
total;



document.getElementById(
"defectos-criticos"
).textContent =
criticos;



document.getElementById(
"defectos-mayores"
).textContent =
mayores;



document.getElementById(
"defectos-menores"
).textContent =
menores;



}









/* ==========================================
   DISTRIBUCIÓN
========================================== */


function renderDist(){



const cont =
document.getElementById(
"dist-bars"
);



if(!cont)
return;



cont.innerHTML="";



const grupos={};



defectos.forEach(d=>{


grupos[d.tipo] =
(grupos[d.tipo] || 0)
+
d.piezas;


});



const total =
Object.values(grupos)
.reduce(
(a,b)=>a+b,
0
);



Object.entries(grupos)
.forEach(
([tipo,cantidad])=>{


const porcentaje =
total
?
Math.round(
cantidad/total*100
)
:
0;



cont.innerHTML += `


<div class="dist-bar-item">


<div class="dist-bar-label">

<span>
${tipo}
</span>


<span>
${cantidad} uds
</span>


</div>



<div class="dist-track">


<div 
class="dist-fill"
style="width:${porcentaje}%">

</div>


</div>


</div>


`;



});


}









/* ==========================================
   TOP DEFECTOS
========================================== */


function renderTop(){


const cont =
document.getElementById(
"top-defectos"
);



if(!cont)
return;



cont.innerHTML="";



const grupos={};



defectos.forEach(d=>{


grupos[d.tipo]=
(grupos[d.tipo]||0)
+
d.piezas;


});



Object.entries(grupos)
.sort(
(a,b)=>b[1]-a[1]
)
.slice(0,4)
.forEach(
(item,index)=>{


cont.innerHTML += `


<div class="top-item">


<div class="top-rank">
${index+1}
</div>



<div class="top-info">


<div class="top-name">
${item[0]}
</div>


<div class="top-count">
${item[1]} piezas
</div>


</div>


</div>


`;



});


}









/* ==========================================
   TABLA
========================================== */


function clsMap(clase){


return {

"Crítico":
"badge-danger",

"Mayor":
"badge-warning",

"Menor":
"badge-info"


}[clase]
||
"badge-neutral";


}




function renderTabla(){



const tbody =
document.getElementById(
"tabla-def"
);



if(!tbody)
return;



tbody.innerHTML="";



defectos.forEach(d=>{


tbody.innerHTML += `


<tr>


<td>
${d.lote}
</td>


<td>
${d.tipo}
</td>


<td>

<span class="badge ${clsMap(d.clase)}">

${d.clase}

</span>


</td>


<td>
${d.piezas}
</td>


<td>
${d.zona}
</td>


<td>
${d.inspector}
</td>


<td>
${d.fecha}
</td>



</tr>


`;



});


}









/* ==========================================
   REGISTRAR DEFECTO
========================================== */


document
.getElementById(
"btn-def"
)
?.addEventListener(
"click",
async()=>{



const body={


codigo_lote:
document.getElementById(
"d-lote"
).value,


tipo_defecto:
document.getElementById(
"d-tipo"
).value,


clasificacion:
document.getElementById(
"d-clase"
).value,


cantidad_piezas:
Number(
document.getElementById(
"d-qty"
).value
),


zona_deteccion:
document.getElementById(
"d-zona"
).value,


inspector:
document.getElementById(
"d-inspector"
).value,


descripcion:
document.getElementById(
"d-desc"
)?.value || null


};




if(
!body.codigo_lote ||
!body.tipo_defecto ||
!body.clasificacion ||
!body.cantidad_piezas ||
!body.zona_deteccion ||
!body.inspector
){

alert(
"Completa todos los campos"
);

return;

}




try{


const response =
await fetch(
`${API_URL}/defectos/`,
{

method:"POST",

headers:{
"Content-Type":
"application/json"
},

body:
JSON.stringify(body)

}

);




if(!response.ok){


const error =
await response.json();


console.error(
error
);


throw new Error(
"Error registrando defecto"
);


}



alert(
"Defecto registrado correctamente"
);



limpiarFormulario();



cargarDefectos();



}
catch(error){


console.error(
error
);


}



});










/* ==========================================
   LIMPIAR
========================================== */


document
.getElementById(
"btn-def-clear"
)
?.addEventListener(
"click",
limpiarFormulario
);



function limpiarFormulario(){



[
"d-lote",
"d-qty",
"d-inspector",
"d-desc"

].forEach(id=>{


const e =
document.getElementById(id);


if(e)
e.value="";


});



[
"d-tipo",
"d-clase",
"d-zona"

].forEach(id=>{


const e =
document.getElementById(id);


if(e)
e.selectedIndex=0;


});


}









/* ==========================================
   INICIO
========================================== */


document.addEventListener(
"DOMContentLoaded",
()=>{

/* ==========================================
   INICIO - Verificar sesión primero
========================================== */

console.log('🔐 Verificando sesión...');
verificarSesion();

console.log(
"Defectos Venvidrio iniciado"
);


cargarDefectos();


});


})();
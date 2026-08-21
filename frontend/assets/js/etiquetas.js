/* ==========================================
   VENVIDRIO - ETIQUETAS
   etiquetas.js
========================================== */


(function(){

'use strict';

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
    cargarEtiquetas();
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



let etiquetas = [];

let qrInstance = null;





/* ==========================================
   CARGAR ETIQUETAS
========================================== */


async function cargarEtiquetas(){


    try{


        const response =
        await fetch(
            `${API_URL}/etiquetas/`
        );



        if(!response.ok){

            throw new Error(
                "Error cargando etiquetas"
            );

        }



        const data =
        await response.json();



        etiquetas =
        data.map(e=>({


            lote:
                e.codigo_lote,


            prod:
                e.producto,


            dims:
                e.dimensiones,


            qty:
                e.cantidad,


            cliente:
                e.cliente,


            estado:
                e.estado,


            hora:
                new Date(
                    e.fecha_registro
                )
                .toLocaleTimeString(
                    [],
                    {
                        hour:"2-digit",
                        minute:"2-digit"
                    }
                )



        }));



        renderTabla();


    }


    catch(error){


        console.error(
            "Error etiquetas:",
            error
        );


    }


}









/* ==========================================
   ESTADO BADGE
========================================== */


function estadoLbl(e){


    const map={

        aprobado:
        "badge-success",


        condicionado:
        "badge-warning",


        retenido:
        "badge-danger"

    };


    const texto={

        aprobado:
        "Aprobado",


        condicionado:
        "Condicionado",


        retenido:
        "Retenido"

    };



    return `

    <span class="badge ${map[e]}">

        ${texto[e] || e}

    </span>

    `;


}









/* ==========================================
   TABLA
========================================== */


function renderTabla(){



const tbody =
document.getElementById(
    "tabla-etq"
);



if(!tbody)
return;



tbody.innerHTML="";



etiquetas.forEach(e=>{


tbody.innerHTML += `



<tr>


<td class="font-mono">

${e.lote}

</td>



<td>

${e.prod}

</td>




<td>

${e.dims}

</td>




<td>

${e.qty}

</td>




<td>

${e.cliente}

</td>




<td>

${estadoLbl(e.estado)}

</td>




<td>

${e.hora}

</td>




<td>


<button 
class="btn btn-outline btn-sm"
onclick="reimprimirEtq('${e.lote}')">

<i class="ti ti-printer"></i>

</button>


</td>



</tr>



`;



});



}









/* ==========================================
   GENERAR ETIQUETA
========================================== */


async function generar(){



const lote =
document.getElementById(
"e-lote"
).value.trim();



const prod =
document.getElementById(
"e-prod"
).value;



const dims =
document.getElementById(
"e-dims"
).value.trim();



const esp =
document.getElementById(
"e-esp"
).value;



const qty =
Number(
document.getElementById(
"e-qty"
).value
);



const cliente =
document.getElementById(
"e-cliente"
).value.trim();



const norma =
document.getElementById(
"e-norma"
).value;



const estado =
document.getElementById(
"e-estado"
).value;





if(
!lote ||
!prod ||
!dims ||
!esp ||
!qty ||
!cliente
){


alert(
"Completa todos los campos"
);


return;


}






const body={



codigo_lote:
lote,


producto:
prod,


dimensiones:
dims,


espesor:
esp,


cantidad:
qty,


cliente:
cliente,


norma:
norma,


estado:
estado



};






const response =
await fetch(

`${API_URL}/etiquetas/`,

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


alert(
"Error guardando etiqueta"
);


return;


}






mostrarEtiqueta(
body
);




cargarEtiquetas();



}









/* ==========================================
   VISTA PREVIA
========================================== */


function mostrarEtiqueta(e){



const preview =
document.getElementById(
"label-preview"
);



const fecha =
new Date()
.toLocaleDateString(
"es-MX"
);



const hora =
new Date()
.toTimeString()
.slice(0,5);





const qrData =

`
VENVIDRIO|
LOTE:${e.codigo_lote || e.lote}|
PROD:${e.producto || e.prod}|
DIM:${e.dimensiones || e.dims}|
QTY:${e.cantidad || e.qty}
`;






preview.innerHTML = `



<div class="label-card">


<div class="label-header">


<div>


<div class="label-brand">

VENV<span>IDRIO</span>

</div>


<div class="label-subtitle">

Control de Calidad

</div>


</div>


<div>

${e.codigo_lote || e.lote}

</div>


</div>





<div class="label-body">


<div class="label-info">


<div class="label-product">

${e.producto || e.prod}

</div>



<div class="label-row">

<span>
Dimensiones
</span>

<b>
${e.dimensiones || e.dims}
</b>

</div>



<div class="label-row">

<span>
Cantidad
</span>

<b>
${e.cantidad || e.qty}
</b>

</div>



<div class="label-row">

<span>
Cliente
</span>

<b>
${e.cliente}
</b>

</div>



<div class="label-row">

<span>
Fecha
</span>

<b>
${fecha}
</b>

</div>


</div>




<div class="label-qr">


<div id="qr-container"></div>


</div>



</div>





<div class="label-footer">


${e.estado}


<span>

${hora}

</span>


</div>


</div>



`;







if(qrInstance){

qrInstance.clear();

}



qrInstance =
new QRCode(
document.getElementById(
"qr-container"
),
{

text:
qrData,


width:
96,


height:
96,


correctLevel:
QRCode.CorrectLevel.M

}

);



document
.getElementById(
"btn-actions"
)
.style.opacity="1";



}









/* ==========================================
   BOTONES
========================================== */


document
.getElementById(
"btn-generar"
)
?.addEventListener(
"click",
generar
);






document
.getElementById(
"btn-limpiar-etq"
)
?.addEventListener(
"click",
()=>{


[
"e-lote",
"e-dims",
"e-esp",
"e-qty",
"e-cliente"

]
.forEach(id=>{

document.getElementById(id).value="";


});



document
.getElementById(
"label-preview"
)
.innerHTML=`

<div class="label-empty">

<i class="ti ti-tag"></i>

<p>
Completa el formulario
</p>

</div>

`;



});







document
.getElementById(
"btn-imprimir"
)
?.addEventListener(
"click",
()=>{

window.print();

}

);






window.reimprimirEtq =
function(lote){


document
.getElementById(
"e-lote"
)
.value=lote;



window.scrollTo({

top:0,

behavior:"smooth"

});


};









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
"Etiquetas Venvidrio iniciado"
);


cargarEtiquetas();


});




})();
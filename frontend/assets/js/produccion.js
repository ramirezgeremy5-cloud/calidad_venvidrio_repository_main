/* produccion.js */
(function () {
  'use strict';


  const API_URL = "http://127.0.0.1:8000";


  const LINEAS = [
    { name: 'Línea A — Corte',       pct: 88, status: 'success', meta: 'Producción activa' },
    { name: 'Línea B — Templado',    pct: 72, status: 'warning', meta: 'Producción activa' },
    { name: 'Línea C — Laminado',    pct: 95, status: 'success', meta: 'Producción activa' },
    { name: 'Línea D — Serigrafía',  pct: 41, status: 'danger',  meta: 'Producción pausada' },
  ];


  let lotes = [];


  /* ===============================
      CARGAR PRODUCCIÓN DESDE API
  =============================== */

  async function cargarProduccion(){

    try{

      const response = await fetch(
        `${API_URL}/produccion`
      );


      if(!response.ok){
        throw new Error(
          "Error obteniendo producción"
        );
      }


      const data = await response.json();


      lotes = data.map(p => ({

        id: p.codigo_lote,

        prod: p.tipo_producto,

        linea: p.linea_produccion,

        op: p.operador,

        uds: p.cantidad,

        rechazos: 0,

        estado: "En proceso",

        hora: new Date(
          p.fecha_registro
        ).toLocaleTimeString(
          [],
          {
            hour:"2-digit",
            minute:"2-digit"
          }
        )

      }));


      renderTabla();


      const contador =
        document.getElementById(
          'cnt-lotes'
        );


      if(contador){
        contador.textContent =
          lotes.length;
      }


    }catch(error){

      console.error(
        "Error cargando producción:",
        error
      );

    }

  }




  /* ===============================
        RENDER LINEAS
  =============================== */

  function renderLineas(){

    const container =
      document.getElementById(
        'lineas-list'
      );


    if(!container) return;


    container.innerHTML = '';


    LINEAS.forEach((l,i)=>{


      const div =
      document.createElement('div');


      div.className =
        'linea-item';


      div.style.animationDelay =
        `${0.1*i}s`;



      div.innerHTML = `

        <div class="linea-header">

          <span class="linea-name">
            ${l.name}
          </span>

          <span class="linea-pct">
            ${l.pct}%
          </span>

        </div>


        <div class="progress-track">

          <div 
          class="progress-bar ${l.status}"
          data-pct="${l.pct}"
          style="width:0">
          </div>

        </div>


        <div class="linea-meta">
          ${l.meta}
        </div>

      `;


      container.appendChild(div);


    });



    setTimeout(()=>{


      document
      .querySelectorAll('.progress-bar')
      .forEach(bar=>{

        bar.style.width =
        bar.dataset.pct + "%";

      });


    },200);


  }





  /* ===============================
          ESTADOS
  =============================== */


  function estadoBadge(e){

    const map = {

      'Aprobado':
      'badge-success',

      'Rechazado':
      'badge-danger',

      'Revisión':
      'badge-warning',

      'En proceso':
      'badge-info'

    };


    return `

    <span class="badge ${map[e] || 'badge-neutral'}">

      ${e}

    </span>

    `;

  }






  /* ===============================
          TABLA
  =============================== */


  function renderTabla(
    filtro=''
  ){


    const tbody =
      document.getElementById(
        'tabla-lotes'
      );


    if(!tbody) return;



    const data =
      filtro
      ?
      lotes.filter(l=>


        l.id
        .toLowerCase()
        .includes(filtro)


        ||

        l.prod
        .toLowerCase()
        .includes(filtro)


        ||

        l.op
        .toLowerCase()
        .includes(filtro)


      )

      :

      lotes;



    tbody.innerHTML='';



    data.forEach((l,i)=>{


      const tr =
      document.createElement('tr');


      tr.style.animationDelay =
      `${0.04*i}s`;



      tr.innerHTML = `


        <td class="font-mono"
        style="font-size:12px">

          ${l.id}

        </td>


        <td>
          ${l.prod}
        </td>


        <td>
          ${l.linea}
        </td>


        <td>
          ${l.op}
        </td>


        <td>
          ${l.uds}
        </td>


        <td>

          ${l.rechazos}

        </td>


        <td>

          ${estadoBadge(
            l.estado
          )}

        </td>


        <td class="text-muted text-sm">

          ${l.hora}

        </td>


      `;


      tbody.appendChild(tr);


    });


  }





  /* ===============================
          REGISTRAR PRODUCCIÓN
  =============================== */


  const btnRegistrar =
  document.getElementById(
    'btn-registrar'
  );


  if(btnRegistrar){


    btnRegistrar.addEventListener(
      'click',
      async()=>{


      const id =
      document.getElementById(
        'lote-id'
      )
      .value
      .trim();



      const linea =
      document.getElementById(
        'linea'
      )
      .value;



      const prod =
      document.getElementById(
        'producto'
      )
      .value;



      const cant =
      document.getElementById(
        'cantidad'
      )
      .value;



      const op =
      document.getElementById(
        'operador'
      )
      .value
      .trim();



      if(
        !id ||
        !linea ||
        !prod ||
        !cant ||
        !op
      ){

        alert(
          "Completa todos los campos obligatorios."
        );

        return;

      }




      try{


        const response =
        await fetch(

          `${API_URL}/produccion`,

          {

            method:"POST",

            headers:{

              "Content-Type":
              "application/json"

            },


            body:
            JSON.stringify({

              codigo_lote:id,

              linea_produccion:linea,

              tipo_producto:prod,

              cantidad:
              parseInt(cant),


              operador:op,


              turno:
              document.getElementById(
                'turno'
              ).value,


              observaciones:
              document.getElementById(
                'obs-prod'
              ).value


            })


          }

        );



        if(!response.ok){

          throw new Error(
            "Error guardando"
          );

        }



        await cargarProduccion();




        const toast =
        document.getElementById(
          'toast-prod'
        );


        if(toast){

          toast.classList.add(
            'show'
          );


          setTimeout(()=>{

            toast.classList.remove(
              'show'
            );

          },3000);

        }




        document
        .getElementById(
          'btn-limpiar'
        )
        .click();



      }
      catch(error){


        console.error(error);


        alert(
          "No se pudo registrar la producción"
        );


      }



    });


  }






  /* ===============================
          LIMPIAR FORMULARIO
  =============================== */


  const btnLimpiar =
  document.getElementById(
    'btn-limpiar'
  );


  if(btnLimpiar){


    btnLimpiar.addEventListener(
      'click',
      ()=>{


      [
        'lote-id',
        'cantidad',
        'operador',
        'obs-prod'

      ]
      .forEach(id=>{


        const el =
        document.getElementById(id);


        if(el)
        el.value='';


      });



      [
        'linea',
        'producto',
        'turno'

      ]
      .forEach(id=>{


        const el =
        document.getElementById(id);


        if(el)
        el.selectedIndex=0;


      });


    });


  }






  /* ===============================
            BUSCADOR
  =============================== */


  const buscar =
  document.getElementById(
    'buscar-lote'
  );


  if(buscar){


    buscar.addEventListener(
      'input',
      e=>{


        renderTabla(
          e.target.value
          .toLowerCase()
        );


      });


  }





  /* ===============================
             INIT
  =============================== */


  renderLineas();

  cargarProduccion();



})();
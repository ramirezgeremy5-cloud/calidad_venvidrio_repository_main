/* ==========================================
   VENVIDRIO - DASHBOARD
   dashboard.js
========================================== */


const API_URL = "http://127.0.0.1:8000";


let productionChart = null;



/* ==========================================
   CARGAR ESTADÍSTICAS KPI
========================================== */


async function cargarDashboard(){

    try {


        console.log(
            "Cargando estadísticas del dashboard..."
        );


        const response = await fetch(
            `${API_URL}/dashboard/stats`
        );


        if(!response.ok){

            throw new Error(
                "Error consultando estadísticas"
            );

        }


        const data =
            await response.json();


        console.log(
            "Dashboard recibido:",
            data
        );



        const lotes =
            document.getElementById("dash-lotes");


        if(lotes){

            lotes.textContent =
                data.lotes ?? 0;

        }



        const unidades =
            document.getElementById("dash-unidades");


        if(unidades){

            unidades.textContent =
                data.unidades ?? 0;

        }



        const defectos =
            document.getElementById("dash-defectos");


        if(defectos){

            defectos.textContent =
                data.defectos ?? 0;

        }



        const eficiencia =
            document.getElementById("dash-eficiencia");


        if(eficiencia){

            eficiencia.textContent =
                data.eficiencia ?? "0%";

        }



        crearGrafica(data);


    }


    catch(error){

        console.error(
            "Error cargando dashboard:",
            error
        );

    }

}







/* ==========================================
   CARGAR ÚLTIMOS REGISTROS
========================================== */


async function cargarUltimos(){

    try{


        const response =
            await fetch(
                `${API_URL}/dashboard/ultimos`
            );


        if(!response.ok){

            throw new Error(
                "Error cargando registros"
            );

        }


        const registros =
            await response.json();



        console.log(
            "Últimos registros:",
            registros
        );



        const tabla =
            document.getElementById(
                "dashboard-table"
            );



        if(!tabla)
            return;



        tabla.innerHTML = "";



        registros.forEach(registro=>{


            const fila =
                document.createElement(
                    "tr"
                );



            fila.innerHTML = `

                <td>${registro.fecha}</td>

                <td>${registro.linea}</td>

                <td>${registro.producto}</td>

                <td>
                    <span class="badge badge-success">
                        ${registro.estado}
                    </span>
                </td>

            `;


            tabla.appendChild(fila);


        });


    }


    catch(error){


        console.error(
            "Error cargando últimos registros:",
            error
        );


    }

}









/* ==========================================
   CARGAR ALERTAS DEL SISTEMA
========================================== */


async function cargarAlertas(){


    try{


        console.log(
            "Cargando alertas..."
        );


        const response =
            await fetch(
                `${API_URL}/dashboard/alerts`
            );



        if(!response.ok){

            throw new Error(
                "Error cargando alertas"
            );

        }



        const alertas =
            await response.json();



        console.log(
            "Alertas recibidas:",
            alertas
        );



        const lista =
            document.getElementById(
                "dashboard-alerts"
            );



        if(!lista)
            return;



        lista.innerHTML = "";



        alertas.forEach(alerta=>{


            const li =
                document.createElement(
                    "li"
                );



            let icono = "✔";



            if(alerta.tipo === "warning"){

                icono = "⚠";

            }



            if(alerta.tipo === "danger"){

                icono = "❌";

            }



            li.innerHTML = `

                ${icono}
                ${alerta.mensaje}

            `;



            lista.appendChild(li);


        });



    }


    catch(error){


        console.error(
            "Error cargando alertas:",
            error
        );


    }


}









/* ==========================================
   GRÁFICA PRODUCCIÓN
========================================== */


function crearGrafica(data){


    const canvas =
        document.getElementById(
            "productionChart"
        );



    if(!canvas)
        return;



    if(productionChart){

        productionChart.destroy();

    }



    productionChart =
        new Chart(
            canvas,
            {

                type:"bar",


                data:{


                    labels:[

                        "Producción",
                        "Defectos"

                    ],


                    datasets:[

                        {

                            label:
                            "Cantidad",


                            data:[

                                data.unidades ?? 0,

                                data.defectos ?? 0

                            ]

                        }

                    ]

                },


                options:{


                    responsive:true,


                    scales:{


                        y:{


                            beginAtZero:true


                        }


                    }


                }


            }

        );


}









/* ==========================================
   INICIALIZACIÓN
========================================== */


document.addEventListener(
    "DOMContentLoaded",
    ()=>{


        console.log(
            "Dashboard Venvidrio iniciado"
        );



        cargarDashboard();


        cargarUltimos();


        cargarAlertas();



    }
);
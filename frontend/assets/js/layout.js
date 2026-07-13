document.addEventListener("DOMContentLoaded", async () => {

    // ==========================
    // CARGAR SIDEBAR
    // ==========================

    const sidebar = document.getElementById("sidebar-container");

    if(sidebar){

        const response =
            await fetch("components/sidebar.html");

        sidebar.innerHTML =
            await response.text();

    }

    // ==========================
    // CARGAR HEADER
    // ==========================

    const header =
        document.getElementById("header-container");

    if(header){

        const response =
            await fetch("components/header.html");

        header.innerHTML =
            await response.text();

    }

    // ==========================
    // CARGAR USUARIO
    // ==========================

    const usuario =
        JSON.parse(localStorage.getItem("usuario"));

    if(usuario){

        setTimeout(()=>{

            const nombre =
                document.getElementById("user-name");

            const rol =
                document.getElementById("user-role");

            const avatar =
                document.getElementById("avatar");

            if(nombre)
                nombre.textContent=usuario.nombre;

            if(rol)
                rol.textContent=usuario.rol;

            if(avatar){

                avatar.textContent=
                    usuario.nombre
                    .split(" ")
                    .map(p=>p[0])
                    .join("")
                    .substring(0,2)
                    .toUpperCase();

            }

        },100);

    }

    // ==========================
    // BOTÓN CERRAR SESIÓN
    // ==========================

    document.addEventListener("click",(e)=>{

        if(e.target.closest("#logout-btn")){

            localStorage.removeItem("token");

            localStorage.removeItem("usuario");

            window.location.href="login.html";

        }

    });

});
let escaneoActivo = true;

let camaraActiva = false;



/*
========================================
PISTOLA USB
========================================
*/

document
.getElementById('busquedaProducto')
.addEventListener('change', function() {

    const codigo = this.value.trim();

    if (codigo !== '') {

        buscarProductoPorCodigo(codigo);
    }

    this.value = '';
});



/*
========================================
ACTIVAR CAMARA SOLO SI SE NECESITA
========================================
*/

function activarCamara() {

    const container =
    document.getElementById('scannerContainer');

    const boton =
    document.getElementById('btnActivarCamara');



    /*
    ========================================
    APAGAR CAMARA
    ========================================
    */

    if (camaraActiva) {

        Quagga.stop();

        container.style.display = 'none';

        boton.innerHTML = '<i class="bi bi-camera-fill" aria-hidden="true"></i> Activar cámara';

        camaraActiva = false;


        return;
    }



    /*
    ========================================
    ENCENDER CAMARA
    ========================================
    */

    camaraActiva = true;

    container.style.display = 'block';

    boton.innerHTML = '<i class="bi bi-camera-video-off-fill" aria-hidden="true"></i> Apagar cámara';



    Quagga.init({

        inputStream: {

            type: 'LiveStream',

            constraints: {

                width: 400,

                height: 250,

                facingMode: 'environment'
            },

            target: document.querySelector('#scanner')
        },

        decoder: {

            readers: [

                'ean_reader',

                'ean_8_reader',

                'code_128_reader'
            ]
        }

    }, function(err) {

        if (err) {

            console.error(err);

            alert('No se pudo iniciar la cámara');

            camaraActiva = false;
            container.style.display = 'none';
            boton.innerHTML = '<i class="bi bi-camera-fill" aria-hidden="true"></i> Activar cámara';

            return;
        }


        Quagga.start();
    });
}


/*
========================================
DETECTAR CODIGO
========================================
*/

Quagga.onDetected(async function(result) {

    if (!escaneoActivo) return;

    escaneoActivo = false;

    const codigo = result.codeResult.code;


    buscarProductoPorCodigo(codigo);

    setTimeout(() => {

        escaneoActivo = true;

    }, 2000);
});



/*
========================================
BUSCAR PRODUCTO
========================================
*/

async function buscarProductoPorCodigo(codigo) {

    try {

        const response = await fetch(
            window.apiUrl('inventario/buscar/?q=' + encodeURIComponent(codigo)),
            {headers: {"Authorization": "Bearer " + localStorage.getItem("token")}}
        );

        if (!response.ok) {

            throw new Error('Error servidor');
        }

        const productos = await response.json();

        if (productos.length > 0) {

            seleccionarProducto(productos[0]);

        } else {

            alert('âŒ Producto no encontrado');
        }

    } catch(error) {

        console.error(error);
    }
}






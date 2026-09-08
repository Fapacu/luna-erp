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

        boton.innerHTML = '📷 Activar Cámara';

        camaraActiva = false;

        console.log('📷 Cámara apagada');

        return;
    }



    /*
    ========================================
    ENCENDER CAMARA
    ========================================
    */

    camaraActiva = true;

    container.style.display = 'block';

    boton.innerHTML = '❌ Apagar Cámara';



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

            alert('No se pudo iniciar cámara');

            return;
        }

        console.log('📷 Cámara iniciada');

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

    console.log('📦 Código detectado:', codigo);

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
            'http://127.0.0.1:8000/api/productos/buscar/?q=' + codigo + '/'
        );

        if (!response.ok) {

            throw new Error('Error servidor');
        }

        const productos = await response.json();

        if (productos.length > 0) {

            agregarProducto(productos[0]);

        } else {

            alert('❌ Producto no encontrado');
        }

    } catch(error) {

        console.error(error);
    }
}
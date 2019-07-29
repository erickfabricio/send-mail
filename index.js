const nodemailer = require('nodemailer');
const request = require("request-promise");

const apiUri = "http://localhost:3000/api";
const time = 10000 //10s

get();

/**
 * Bucle infinito para la busqueda de notificaciones.
 */
async function start(){    
    while(true){
        get();
        await sleep(time);        
    }
}

/**
 * Obtiene un Array con de las notificaciones pendientes.
 */
function get(){
    request.get(
        {
            uri: `${apiUri}/notifications`,
            json: true,
            body: {query: {state : "P"}, parms: ""}
        }
    ).then(notifications => {
        notifications.forEach(notification => {            
            generate(notification);            
            update(notification);
        })
    });
}

/**
 * Verifica que el producto este activo para su envio.
 * @param {*} notification 
 */
function generate(notification){        
    request.get(
        {
            uri: `${apiUri}/products`,
            json: true,
            body: {query:{ _id: notification.product}, parms: "service name mail password state"}
        }
    ).then(products => {
        if(products.length > 0){
            let product =  products[0]; 
            if(product.state == "A"){                
                send(product, notification);
            }else{
                notification.state = `I:Producto inactivo`;
            }
        }else{
            notification.state = `X:Producto no existente`;
        }
    });
}

/**
 * Envio de correo
 * @param {*} product 
 * @param {*} notification 
 */
function send(product, notification){
    //Autenticacion
    let transporter = nodemailer.createTransport({
        service: product.service,
        auth: {
          user: product.mail,
          pass: product.password
        }
    });
    
    //Correo
    let options = {
        from: `${product.name} <${product.mail}>`,
        to: notification.message.to,
        cc: notification.message.cc,
        subject: notification.message.subject,        
        html: notification.message.html
    };
    
    //Enviar
    transporter.sendMail(options, function(error, info){
        if (error) {          
          notification.state = `X:Error de envio-${error}`;
        } else {                        
            notification.state = "A";                   
        }
    });
}

/**
 * Actualización de la notificación.
 * @param {*} notification 
 */
function update(notification){   
    request.put(
        {
            uri: `${apiUri}/notifications/${notification._id}`,
            json: true,
            body: {state: notification.state}
        }
    ).then(body => {
        console.log(notification.state);
        console.log(body);
    });
}
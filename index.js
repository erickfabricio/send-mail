const nodemailer = require('nodemailer');
const request = require("request-promise");
const util = require('util');
const sleep = util.promisify(setTimeout);

const api = "http://localhost:3000/api";
const time = 5000 //10s
var ciclos = 0;

start();

/**
 * Bucle infinito para la busqueda de notificaciones.
 */
async function start(){    
    while(true){
        ciclos++;

        await console.log("********* Inicio ciclo: " + ciclos + " *********");
        console.time('Measuring time');

        await get();
        await sleep(time);

        console.timeEnd('Measuring time');
        await console.log("********* Fin ciclo: " + ciclos + " ********* \r\n");        
    }
}

/**
 * Obtiene un Array con de las notificaciones pendientes.
 */
async function get(){
    await request.get(
        {
            uri: `${api}/notifications`,
            json: true,
            body: {query: {state : "P"}, parms: ""}
        }
    ).then(notifications => {
        notifications.forEach(async notification => {               
            await generate(notification);
            await update(notification);
        })
        console.log("Notifications: " + notifications.length);
    });
}

/**
 * Verifica que el producto este activo para su envio.
 * @param {*} notification 
 */
async function generate(notification){        
    await request.get(
        {
            uri: `${api}/products`,
            json: true,
            body: {query:{ _id: notification.product}, parms: "service name mail password state"}
        }
    ).then(async products => {
        if(products.length > 0){
            let product =  products[0]; 
            if(product.state == "A"){                
                await send(product, notification);
            }else{
                notification.state = `E:Producto inactivo`;
            }
        }else{
            notification.state = `E:Producto no existente`;
        }
    });
}

/**
 * Send mail
 * @param {*} product 
 * @param {*} notification 
 */
async function send(product, notification){
    //Authentication
    let transporter = await nodemailer.createTransport({
        service: product.service,
        auth: {
          user: product.mail,
          pass: product.password
        }
    });
    
    //Mail    
    let options = {
        from: `${product.name} <${product.mail}>`,
        to: notification.message.to,
        cc: notification.message.cc,
        cco: notification.message.cco,        
        subject: notification.message.subject,        
        html: notification.message.html,
        attachments: notification.message.attachments
    };
    
    //Submit
    let info = await transporter.sendMail(options);    
    //console.log(info);

    if(info.response == '250 Message received'){
        notification.state = "S"; //Sent
    }else{
        notification.state = "E*" + info; //Error
    }
}

/**
 * Actualización de la notificación.
 * @param {*} notification 
 */
async function update(notification){   
    await request.put(
        {
            uri: `${api}/notifications/${notification._id}`,
            json: true,
            body: {state: notification.state, sentDate: new Date()}
        }
    ).then(body => {
        console.log(notification.state);
        console.log(body);        
    });
}
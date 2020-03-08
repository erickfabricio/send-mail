/**
 * Autor...: Erick Fabricio Martínez Castellanos
 * Web.....: https://erickfabricio.com
 * Email...: mail@erickfabricio.com
 * GitHub..: https://github.com/erickfabricio
 */

const nodemailer = require('nodemailer');
const request = require("request-promise");
const util = require('util');
const sleep = util.promisify(setTimeout);
const config = require('./config');

const api = config.api;
const time = config.time;
const token = config.token;
var cycles = 0;
var notificationsProcessed = [];

start();

/**
 * Infinite loop for notification search
 */
async function start() {

    while (true) {
        cycles++;

        await console.log("********* Start cycle: " + cycles + " *********");
        await console.time('Measuring time');


        await process();
        await console.log("Notifications processed: " + notificationsProcessed.length);
        await sleep(time);

        await console.timeEnd('Measuring time');
        await console.log("********* End of cycle: " + cycles + " ********* \r\n");
    }
}

/**
 * Get an Array with pending notifications
 */
async function process() {
    await request.get(
        {
            uri: `${api}/notifications`,
            json: true,
            body: { query: { state: "P" }, parms: "" },
            headers: {
                Authorization: `Bearer ${config.token}`
            }
        }
    ).then(notifications => {

        console.log("Notifications found: " + notifications.length);

        notifications.forEach(async notification => {

            //Verify existence
            const result = notificationsProcessed.find(notificationProcessed => notificationProcessed._id === notification._id);

            if (result === undefined) {
                console.log("The notification will be processed: " + notification._id);
                notificationsProcessed.push(notification);
                await generate(notification);
                await update(notification);
            } else {
                console.log("Notification already exists: " + notification._id);
            }

        })

    });
}

/**
 * Verify that the product is active for shipping
 * @param {*} notification 
 */
async function generate(notification) {

    try {
        await request.get(
            {
                uri: `${api}/products`,
                json: true,
                body: { query: { _id: notification.product }, parms: "service name mail password state" },
                headers: {
                    Authorization: `Bearer ${config.token}`
                }
            }
        ).then(async products => {
            if (products.length > 0) {
                let product = products[0];
                if (product.state == "A") {
                    await send(product, notification);
                } else {
                    notification.state = `E:Inactive product`;
                }
            } else {
                notification.state = `E:Non-existent product`;
            }
        });
    } catch (error) {
        console.log("Product does not exist, product_id:" + notification.product);
        notification.state = `E:Non-existent product`;
    }


}

/**
 * Send mail
 * @param {*} product 
 * @param {*} notification 
 */
async function send(product, notification) {
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

    if (info.response == '250 Message received') {
        notification.state = "S"; //Sent
    } else {
        notification.state = "E*" + info; //Error
    }
}

/**
 * Update notification status
 * @param {*} notification 
 */
async function update(notification) {
    await request.put(
        {
            uri: `${api}/notifications/${notification._id}`,
            json: true,
            body: { state: notification.state, sentDate: new Date() },
            headers: {
                Authorization: `Bearer ${config.token}`
            }
        }
    ).then(body => {
        //console.log(notification.state);
        //console.log(body);        
    });
}
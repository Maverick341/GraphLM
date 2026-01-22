import Mailgen from "mailgen";
import nodemailer from "nodemailer";
import config from "../config/config";

export const sendMail = async (options) => {
    const mailGenerator = new Mailgen({
        theme: 'default',
        product: {
            // Appears in header & footer of e-mails
            name: 'Express Auth',
            link: 'https://mailgen.js/'
            // Optional product logo
            // logo: 'https://mailgen.js/img/logo.png'
        }
    });

    const emailHTML = mailGenerator.generate(options.mailGenContent);
    const emailText = mailGenerator.generatePlaintext(options.mailGenContent);

    const transporter = nodemailer.createTransport({
        host: config.MAILTRAP_SMTP_HOST,
        port: config.MAILTRAP_SMTP_PORT,
        secure: false, // true for port 465, false for other ports
        auth: {
            user: config.MAILTRAP_SMTP_USER,
            pass: config.MAILTRAP_SMTP_PASS,
        },
    });

    const mail = {
        from: '"Maddison Foo Koch 👻" <maddison53@ethereal.email>', // sender address
        // from: `"${config.MAIL_FROM_NAME}" <${config.MAIL_FROM_EMAIL}>`,
        to: options.email, // list of receivers
        subject: options.subject, // Subject line
        text: emailText, // plain text body
        html: emailHTML, // html body
    }

    try {
        await transporter.sendMail(mail)
    } catch (error) {
        console.error("Error occurred while sending mail:", error);
    }
}

export const emailVerificationMailGenContent = (username, verificationUrl) => {
    return {
        body: {
            name: username,
            intro: 'Welcome to App! We\'re very excited to have you on board.',
            action: {
                instructions: 'To get started with Our App, please click here:',
                button: {
                    color: '#22BC66',
                    text: 'Verify your email',
                    link: verificationUrl,
                }
            },
            outro: 'Need help, or have questions? Just reply to this email, we\'d love to help.'
        }
    }
}

export const resetPasswordMailGenContent = (username, passwordResetUrl) => {
    return {
        body: {
            name: username,
            intro: 'You have received this email because a password reset request for your account was received.',
            action: {
                instructions: 'Click the button below to reset your password:',
                button: {
                    color: '#DC4D2F',
                    text: 'Reset your password',
                    link: passwordResetUrl,
                }
            },
            outro: 'If you did not request a password reset, no further action is required.'
        }
    }
}


/* EXAMPLE */
// sendMail({
//     email: user.email,
//     subject: "Test",
//     mailGenContent: emailVerificationMailGenContent(username, verificationUrl)
// })
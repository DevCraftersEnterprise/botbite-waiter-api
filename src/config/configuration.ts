export default () => ({
    app: {
        port: parseInt(process.env.PORT ?? '3000', 10),
        nodeEnv: process.env.NODE_ENV,
    },
    jwt: {
        secret: process.env.JWT_SECRET,
    },
    openai: {
        apiKey: process.env.OPENAI_API_KEY,
    },
    twilio: {
        authToken: process.env.TWILIO_AUTH_TOKEN,
        accountSid: process.env.TWILIO_ACCOUNT_SID,
    },
    cloudinary: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        apiSecret: process.env.CLOUDINARY_API_SECRET,
    },
});
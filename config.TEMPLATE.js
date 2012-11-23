/**
 * Replace the mongo URI with the correct one, and save it as config.js. Do not commit config.js.  
 */
module.exports = {
    "prod" : process.env.NODE_ENV === 'production',
    "mongo" : 'mongodb://user:pass@host:port/dbname'
};
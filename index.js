const app = require("./app");
const user = require("./user");

user.init().then(() => app.listen(process.env.PORT || 3000));
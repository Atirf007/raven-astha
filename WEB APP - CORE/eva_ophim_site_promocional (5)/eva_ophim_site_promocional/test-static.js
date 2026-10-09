const http = require("http");
http.get("http://localhost:3000/app/js/api.js", res => {
  console.log("Status for api.js:", res.statusCode);
});

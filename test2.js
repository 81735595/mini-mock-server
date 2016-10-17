var url = require('url')
module.exports = function(request, response){
	response.writeHead(200, {
		'Content-Type': "application/json"
	});
    var query = url.parse(request.url).query
	response.write(JSON.stringify({
		data: query.split('&')
	}), "binary");
	response.end();
}

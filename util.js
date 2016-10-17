var minimatch = require('minimatch')
var http = require('http')
var fs = require('fs')
var qs = require('querystring')
var url = require('url')
var path = require('path');

function getArgv(argv) {
	var result = {}
	argv.forEach(function(v,i){
		if(!v.indexOf('--')){
			var kv = v.slice(2).split('=')
			result[kv[0]] = typeof kv[1] == 'undefined' ? true : kv[1]
		}
	})
	return result
}

var isFile = function(path) {
    if (fs.existsSync(path) && fs.statSync(path).isFile()) {
        return true
    }
    return false
}

var isDir = function(path) {
    if (fs.existsSync(path) && fs.statSync(path).isDirectory()) {
        return true
    }
    return false
}

var warn = function(msg) {
	console.error('[mini warn]: ' + msg )
}

var is = function(source, type) {
	return toString.call(source) === '[object ' + type + ']';
};

var each = function(source, callback) {
	var i,l;
	if (is(source, 'Array')) {
		for (i = 0, l = source.length;i<l;i++) {
	    	if (callback(source[i], i)) {
		        break;
		    }
		}
	} else if (is(source, 'Object')) {
		i = 0;
		for (l in source) {
	    	if (source.hasOwnProperty(l)) {
	    		if (callback(source[l], l, i++)) {
			        break;
		    	}
		    }
		}
	} else {
		warn('function each need a object or a array')
	}
};

var merge = function() {
	var argv = Array.prototype.slice.call(arguments, 0)
	if (argv.length) {
		var target = argv[0]
		if (is(target, 'Object')) {
			each(argv.slice(1), function (obj) {
				if (is(obj, 'Object')) {
					each(obj, function (v, k) {
						if (typeof v != 'undefined') {
							target[k] = v
						}
					})
				}
			})
		}
		return target
	} else {
		return false
	}
};

var mkValidator = function (rewrites) {
	return function (pathname) {
		pathname = pathname.slice(1)
		var result = false
		each(rewrites, function(v){
			var reg = v.reg
			if (
				( is(reg, 'RegExp') && reg.test(pathname) ) ||
				( is(reg, 'String') && minimatch(pathname, reg) )
			) {
				result = v;
				return false;
			}
		})
		return result
	}
};

var runRewrite = function (rewrite, pathname, confFileDirPath, request, response) {
	var target = rewrite.target
	var method = request.method.toUpperCase()

	switch (rewrite.type) {
		case 'json':
			if (!isAbs(target)) {
				if (confFileDirPath == '.') {
					target = './' + target
				} else {
					target = path.join(confFileDirPath, target)
				}
			}
			fs.readFile(target, {encoding: "binary"}, function(err, file) {
				if (err) {
					response.writeHead(500, {
						'Content-Type': 'text/plain'
					});
					response.end(err);
				} else {
					response.writeHead(200, {
						'Content-Type': "application/json"
					});
					response.write(file, "binary");
					response.end();
				}
			})
			break;
		case 'js':
			if (!isAbs(target)) {
				if (confFileDirPath == '.') {
					target = './' + target
				} else {
					target = path.join(confFileDirPath, target)
				}
			}
			try {
				require(target)(request, response)
			} catch(err) {
				response.writeHead(500, {
					'Content-Type': 'text/plain'
				});
				response.end(err);
			}
			break;
		case 'url':
			target = url.parse(target, true)
			var query = url.parse(request.url).query
			if (query) {
				var i = target.path.indexOf('?')
				if (~i) {
					target.path = target.path.slice(0, i) + '?' + target.path.slice(i + 1) + '&' + query
				} else {
					target.path = target.path + '?' + query
				}
			}
			var options = {
				protocol: target.protocol,
				host: target.host,
				port: target.port,
				path: target.path,
				method: method
			};
			if (method == 'POST') {
				var postData = "";
				request.addListener("data", function (data) {
					postData += data;
				});
				req.addListener("end", function () {
					var req = http.request(options, function(res) {
							res.pipe(response);
						})
					req.write(postData);
					req.end();
				});
			} else if (method == 'GET') {
				var req = http.request(options, function(res) {
						res.pipe(response);
					}).end();
			} else {
				response.writeHead(500, {
					'Content-Type': 'text/plain'
				});
				response.write("method not supported: " + method);
				response.end();
			}
			break;
		default:
			response.writeHead(500, {
				'Content-Type': 'text/plain'
			});
			response.write("invalid rewrite type: " + rewrite.type);
			response.end();
			break;
	}
}

var isAbs = path.isAbsolute

module.exports = {
	getArgv: getArgv,
	isFile: isFile,
	isAbs: isAbs,
	warn: warn,
	merge: merge,
	mkValidator: mkValidator,
	runRewrite: runRewrite
}

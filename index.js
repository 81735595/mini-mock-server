#!/usr/bin/env node

/*
 * TODO
 * 基本功能已经有了，能够根据conf文件的配置进行代理了，也可以自己写逻辑
 * 现在感觉欠缺的部分还有以下几点：
 * - conf.js文件的查找，逻辑还不完善，现在必须制定到conf文件的路径，以后考虑加入制定文件夹自动找conf文件的功能
 * - rewrite url 的功能不完善，并且没有测试post请求，现在是能把内容拉取回来了，但是cookie没有带上，以后要加入带上cookie的功能，应该是有方法的
 * - conf文件里的路由匹配只能支持正则或者glob匹配，glob的匹配规则还不是很明确，后续还的再摸索一下，反正现在是好使了……后续考虑加入路由匹配的功能，能从路由匹配到的路由里读取参数，不然如果rewrite多了，都到js文件，每个js文件里都要做路径解析
 * - 代码太凌乱，其实没几百行代码，最好还是做做抽象，不然以后自己都理不清楚逻辑
 */

var http = require('http');
var url = require('url');
var fs = require('fs');
var path = require('path');
var exts = require('./exts')
var cwd = process.cwd()
var util = require('./util')

var getArgv = util.getArgv
var isFile = util.isFile
var isAbs = util.isAbs
var warn = util.warn
var merge = util.merge
var mkValidator = util.mkValidator
var runRewrite = util.runRewrite

/*
 * 设置全局命令的方法：
 * ln -s /xxx/xxx/mini/index.js /usr/local/bin/mini
 * api设计：
 * $ mini
 * 获取当前文件夹下的conf文件，建立mock server，如果没有conf文件则根据默认设置启动mock server
 * $ mini --path=xx/xx/conf.js
 * 根据path获取相对于当前文件夹的conf文件，建立mock server
 * $ mini --path=/xx/xx/conf.js
 * 根据path获取绝对路径下的conf文件，建立mock server，应该兼容windows的绝对路径
 *
 * conf里面的可配置项
 * port: server建立的端口
 * assets: 网站根目录映射到的文件夹，静态资源的请求都从这里开始查找文件
 * rewrites: mock列表，一个数组，每个元素是一个对象，对象有reg、type、target三个属性、
 *          reg是匹配路径用的正则，或者glob字符串，对最先匹配到的规则进行跳转，
 *          不同的type跳转的方式不同，先支持json、js和url链接，三种跳转，
 *          type是json时，读取target路径指向的文件内容，转化成json返回回去
 *          type是js时，require target指向的js文件，要求require回来的模块必须是个函数，
 *          先检查请求有没有参数，有参数就把参数传入require的函数里，返回执行后的返回值，没参数就直接执行
 *          type是url时，直接请求target指向的url，待这个请求结束后，返回请求的返回值
 */



// 需要一个解析参数的模块
var argv = getArgv(process.argv)
var defaultConf = require('./default-conf')
var confFilePath = argv["path"];
var confFileDirPath
var confFileContent
var conf = {}

if (!confFilePath) {
    confFilePath = './conf.js'
}
if (!isAbs(confFilePath)) {
    confFilePath = path.join(cwd, confFilePath)
}
// if (isFile(confFilePath)) {
//     confFileContent = require(confFilePath)
//     confFileDirPath = path.dirname(confFilePath)
// } else {
//     confFileContent = {}
//     confFileDirPath = cwd
//     warn('not finded conf file, will be use default config')
// }

try {
	confFileContent = require(confFilePath)
    confFileDirPath = path.dirname(confFilePath)
} catch (e) {
	console.error(e)
    warn('conf file parse error, will be use default config')
	confFileContent = {}
	confFileDirPath = cwd
}

try {
    conf = merge({}, defaultConf, confFileContent)
    var port = conf.port;
    var assets = conf.assets;
    var isValidRewrite = mkValidator(conf.rewrites)

    if (!isAbs(assets)) {
        assets = path.resolve(confFileDirPath, assets)
    }

    var server = http.createServer(function(request, response) {
        var localhost = url.parse(request.url, true);
        var pathname = localhost.pathname;
        var query = localhost.query;
        var search = localhost.search;
        var isRoot = false;
        var rewrite = isValidRewrite(pathname)
        if (rewrite) {
            runRewrite(rewrite, pathname, confFileDirPath, request, response)
        } else {
            if (!pathname || pathname == '/') {
                pathname = '/index.html'
                isRoot = true
            }
            var realPath = path.join(assets, pathname)
	        var ext = path.extname(pathname);
	        ext = ext ? ext.slice(1) : 'unknown';

            fs.exists(realPath, function(exists) {
                if (!exists) {
                    if (isRoot) {
                        response.writeHead(200, {
                            'Content-Type': 'text/plain; charset=utf-8'
                        });
                        response.write("╮(╯▽╰)╭");
                        response.end();
                    } else {
                        response.writeHead(404, {
                            'Content-Type': 'text/plain'
                        });

                        response.write("This request URL " + pathname + " was not found on this server.");
                        response.end();
                    }
                } else {
                    fs.readFile(realPath, {
                        encoding: "binary"
                    }, function(err, file) {
                        if (err) {
                            response.writeHead(500, {
                                'Content-Type': 'text/plain'
                            });
                            response.end(err);
                        } else {
                            var contentType = exts[ext] || "text/plain";
                            response.writeHead(200, {
                                'Content-Type': contentType
                            });
                            response.write(file, "binary");
                            response.end();
                        }
                    });
                }
            });
        }
    });
    server.listen(port);
    console.log('server start at localhost:' + port)
} catch (e) {
    process.stderr.write(e.messge);
}

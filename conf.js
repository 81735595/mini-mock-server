module.exports = {
    assets: './asset',
    port: 8081,
	rewrites: [
		{
			reg: "test1/**",
			type: "json",
			target: "test1.json"
		},
		{
			reg: /^test2(\/)?$/,
			type: "js",
			target: "test2.js"
		},
		{
			reg: "**/test3",
			type: "url",
			target: "http://www.baidu.com"
		}
	]
}

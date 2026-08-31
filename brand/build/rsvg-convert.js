const fs = require("fs")
const path = require("path")
const { Resvg } = require("@resvg/resvg-js")

const args = process.argv.slice(2)
let width = null
let height = null
let output = null
let input = null

for (let index = 0; index < args.length; index += 1) {
  const value = args[index]
  if (value === "-w") width = Number(args[++index])
  else if (value === "-h") height = Number(args[++index])
  else if (value === "-o") output = args[++index]
  else if (!value.startsWith("-")) input = value
}

if (!input || !output) {
  process.stderr.write("usage: rsvg-convert [-w width] [-h height] input -o output\n")
  process.exit(2)
}

const fitTo = width ? { mode: "width", value: width } : height ? { mode: "height", value: height } : undefined
const renderer = new Resvg(fs.readFileSync(input), { fitTo })
const png = renderer.render().asPng()
fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, png)

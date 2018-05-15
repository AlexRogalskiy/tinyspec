#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');
const _ = require('lodash');
const YAML = require('yamljs');
const bootprint = require('bootprint');
const bootprintOpenapi = require('bootprint-openapi');
const transformEndpoints = require('./lib/transformEndpoints');
const transformModels = require('./lib/transformModels');

const argv = require('yargs').argv;

const TARGET_YAML_FILE = 'swagger.yaml';
const TARGET_JSON_FILE = 'swagger.json';

const srcDir = process.cwd();
const outputDir = argv.output || argv.o || '.';

let mode = 'help';

if (argv.yaml || argv.y) {
    mode = 'yaml'
} else if (argv.json || argv.j) {
    mode = 'json'
} else if (argv.html || argv.h) {
    mode = 'html'
}

switch (mode) {
    case 'help':
        console.log(
            `Usage:
tinyspec [options]

Options:
    --yaml | -y     Generate OpenAPI/Swagger YAML (default)
    --json | -j     Generate OpenAPI/Swagger JSON
    --html | -h     Generate HTML/CSS document
    --output | -o    Path to output generated files
    --no-default-attrs     Do not add \`id\`, \`created_at\` and \`updated_at\` to all models
    --add-nulls     Include \`null\` as possible value for non-required fields
    --help          Display this help
`
        );
        break;
    case 'yaml':
        fs.writeFileSync(path.join(srcDir, outputDir, TARGET_YAML_FILE), generateYaml());
        break;
    case 'json':
        generateJson(generateYaml(), path.join(srcDir, outputDir, TARGET_JSON_FILE));
        break;
    case 'html':
        const jsonFilePath = path.join(srcDir, TARGET_JSON_FILE);
        const needCleanup = !fs.existsSync(jsonFilePath);

        generateJson(generateYaml(), jsonFilePath);
        generateHtml(jsonFilePath, outputDir)
            .then(function () {
                if (needCleanup) {
                    fs.unlinkSync(jsonFilePath);
                }
            });
        break;
}

function generateYaml() {
    const pattern = path.join(srcDir, '**', '@(models.tinyspec|endpoints.tinyspec|header.yaml)');
    const filePaths = glob.sync(pattern);
    const fileNames = filePaths.map((filePath) => path.basename(filePath));
    const byNames = _.zipObject(fileNames, filePaths);

    return [
        fs.readFileSync(byNames['header.yaml'], 'utf-8'),
        transformEndpoints(fs.readFileSync(byNames['endpoints.tinyspec'], 'utf-8')),
        transformModels(fs.readFileSync(byNames['models.tinyspec'], 'utf-8'))
    ].join('\n');
}

function generateJson(yamlSpec, target) {
    fs.writeFileSync(
        target,
        JSON.stringify(YAML.parse(yamlSpec), null, '  ')
    );
}

function generateHtml(json, target) {
    return bootprint
        .load(bootprintOpenapi)
        .merge({
            handlebars: {
                partials: path.join(__dirname, './bootprint_partials')
            }
        })
        .build(json, target)
        .generate()
        .then(console.log)
        .catch(console.error);
}

import * as fs from 'fs';
import * as path from 'path';
import * as parser from '@babel/parser';
import { Identifier, NewExpression, ObjectExpression } from '@babel/types';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, '../../', 'tmp');

async function prepareHtml(): Promise<void> {
    try {
        console.log('Starting HTML preparation...');

        const entries = await generateToc();

        copyHtmlFiles(entries);

        cleanUpOutputFiles();

    } catch (error) {
        console.error('Error preparing HTML:', error);
        process.exit(1);
    }
}

async function cleanUpOutputFiles(): Promise<void> {
    try {
        console.log('Cleaning up output files...');
        
        // Check if the directory exists
        if (fs.existsSync(OUTPUT_DIR)) {
            // Read all files in the directory
            const files = fs.readdirSync(OUTPUT_DIR, {recursive: true});

            // Delete each file
            for (const file of files) {
                const filePath = path.join(OUTPUT_DIR, file.toString());
                if (fs.existsSync(filePath) && fs.lstatSync(filePath).isFile()) {
                    await cleanUpHtmlFile(filePath);                    
                }
            }
        } else {
            console.log(`Directory ${OUTPUT_DIR} does not exist.`);
        }
    } catch (error) {
        console.error('Error cleaning up output files:', error);
        process.exit(1);
    }
}

async function cleanUpHtmlFile(path: string): Promise<void> {
    try {
        console.log(`Cleaning up HTML file: ${path}`);
        const fileContents = fs.readFileSync(path, 'utf-8');
        const footerRegexp = /<br><br><br>\s*<b><a href="\/prolog">.*?<\/body>/gms;
        const stylesheetRegexp = /<link.*?>/gm;
        const imageRegexp = /<img.*?>/gm;
        const titleRegexp = /<br><br>\s*<center><h1>.*?<\/h1><\/center>\s*<br><br>/gms; // TODO: nefunguje 
        const fileContentsCleaned = fileContents
        .replace(footerRegexp, '</body>')
        .replace(stylesheetRegexp, '')
        .replace(imageRegexp, '')
        .replace(titleRegexp, '');

        const bodyContentRefexp = /<body.*?>(.*?)<\/body>/ms;
        const res = bodyContentRefexp.exec(fileContentsCleaned);
        const bodyContent = res ? res[1] : '';
        fs.writeFileSync(path, bodyContent.trim(), 'utf-8');
        console.log(`Cleaned and saved: ${path}`);
    } catch (error) {
        process.exit(1);
    }
}

async function copyHtmlFiles(entries: TocEntry[]): Promise<void> {
    try {
        console.log('Copying files...');
        const inputDir = path.join(__dirname, '../../',);

        // Create output directory if it doesn't exist
        if (!fs.existsSync(OUTPUT_DIR)) {
            fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        }

        for (const entry of entries) {
            const inputFilePath = path.join(inputDir, entry.url);
            const outputFilePath = path.join(OUTPUT_DIR, entry.url);

            // Create output directory for the file if it doesn't exist
            const outputFileDir = path.dirname(outputFilePath);
            if (!fs.existsSync(outputFileDir)) {
                fs.mkdirSync(outputFileDir, { recursive: true });
            }

            fs.copyFileSync(inputFilePath, outputFilePath);
            console.log(`Copied ${inputFilePath} to ${outputFilePath}`);
        }
    } catch (error) {
        console.error('Error copying files:', error);
        process.exit(1);
    }
}

async function generateToc(): Promise<TocEntry[]> {
    try {
        console.log('Generating table of contents...');
        const inputJsFile = path.join(__dirname, '../../', 'prolog', 'toc.js');
        const jsFileContents = fs.readFileSync(inputJsFile, 'utf-8');
        const entries = parseTocFromJs(jsFileContents);

        const validatedEntries = entries.map(entry => {
            let entryFilePath = path.join(__dirname, '../../', entry.url + '.html');
            const fileExists = fs.existsSync(entryFilePath);
            if (!fileExists) {
                const lastPartName = entry.url.split('/').filter(Boolean).pop();
                entryFilePath = path.join(__dirname, '../../', entry.url, lastPartName + '.html');
                const fileExists = fs.existsSync(entryFilePath);
                if (!fileExists) {
                    entryFilePath = path.join(__dirname, '../../', 'prolog', lastPartName + '.html');
                    const fileExists = fs.existsSync(entryFilePath);
                    if (!fileExists) {
                        console.error(`File not found: ${entryFilePath}`);
                        return null;
                    }
                }
            }

            const url = path.relative(OUTPUT_DIR, entryFilePath).replace(/^\.\.\//g, '');

            return {
                title: entry.title,
                url
            };
        }).filter(entry => entry !== null) as TocEntry[];

        console.log(`Found ${validatedEntries.length} entries in the table of contents.`);
        console.log(validatedEntries);

        const tocPath = path.join(OUTPUT_DIR, 'toc.html');

        // Create output directory if it doesn't exist
        if (!fs.existsSync(OUTPUT_DIR)) {
            fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        }

        // Generate HTML content for the table of contents
        let tocHtml = '<html><head><title>Table of Contents</title></head><body>';
        tocHtml += '<h1>Table of Contents</h1>';
        tocHtml += '<ul>';
        validatedEntries.forEach(entry => {
            tocHtml += `<li><a href="${entry.url}">${entry.title}</a></li>`;
        });
        tocHtml += '</ul>';
        tocHtml += '</body></html>';
        fs.writeFileSync(tocPath, tocHtml, 'utf-8');
        console.log(`Table of contents generated at ${tocPath}`);

        return validatedEntries;

    } catch (error) {
        console.error('Error generating table of contents:', error);
        process.exit(1);
    }
}

type TocEntry = {
    title: string;
    url: string;
};

function parseTocFromJs(fileContents: string): TocEntry[] {
    const parsed = parser.parse(fileContents);
    const jsBody = parsed.program.body;

    let entries: TocEntry[] = [];
    jsBody.forEach((node) => {
        if (node.type === 'VariableDeclaration') {
            const declarations = node.declarations;
            if (declarations.length > 0) {
                const declaration = declarations[0];
                const id = declaration.id;
                if (id && id.type === 'Identifier') {
                    const name = (id as Identifier).name;
                    if (name === 'toc') {
                        const init = declaration.init as NewExpression;
                        const arrayItems = init.arguments;
                        arrayItems.forEach((item) => {
                            const itemObject = item as ObjectExpression;
                            const link = getObjectProperty(itemObject, 'link');
                            const title = getObjectProperty(itemObject, 'title');
                            entries.push({
                                title: title,
                                url: link
                            });
                        });
                    }
                }
            }
        }
    });

    return entries;
}

function getObjectProperty(object: ObjectExpression, key: string): string {
    const properties = object.properties;
    for (const prop of properties) {
        if (prop.type === 'ObjectProperty' && prop.key.type === 'Identifier' && prop.key.name === key) {
            return prop.value.type === 'StringLiteral' ? prop.value.value : '';
        }
    }
    return '';
}

// Run the function
prepareHtml();
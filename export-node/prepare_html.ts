import * as fs from 'fs';
import * as path from 'path';
import * as parser from '@babel/parser';
import { Identifier, NewExpression, ObjectExpression } from '@babel/types';
import { fileURLToPath } from 'url';
import { createCanvas } from 'canvas';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, '../../', 'tmp');

function prepareHtml(): void {
    try {
        console.log('Starting HTML preparation...');

        if (!fs.existsSync(OUTPUT_DIR)) {
            fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        }

        const entries = generateToc();

        const cssFile = path.join(__dirname, '../../', 'prolog', 'prolog.css');
        const cssOutputFile = path.join(OUTPUT_DIR, 'prolog.css');
        if (fs.existsSync(cssFile)) {
            fs.copyFileSync(cssFile, cssOutputFile);
            console.log(`Copied ${cssFile} to ${cssOutputFile}`);
        }

        copyHtmlFiles(entries);

        cleanUpOutputFiles();

        const tocPath = path.join(OUTPUT_DIR, 'toc.json');
        fs.writeFileSync(tocPath, JSON.stringify(entries), 'utf-8');

        generateCoverImage();
    } catch (error) {
        console.error('Error preparing HTML:', error);
        process.exit(1);
    }
}

function cleanUpOutputFiles(): void {
    try {
        console.log('Cleaning up output files...');

        // Check if the directory exists
        if (fs.existsSync(OUTPUT_DIR)) {
            // Read all files in the directory
            const files = fs.readdirSync(OUTPUT_DIR, { recursive: true });

            // Delete each file
            for (const file of files) {
                const filePath = path.join(OUTPUT_DIR, file.toString());
                if (fs.existsSync(filePath) && fs.lstatSync(filePath).isFile()) {
                    cleanUpHtmlFile(filePath);
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

function cleanUpHtmlFile(path: string): void {
    try {
        console.log(`Cleaning up HTML file: ${path}`);
        const fileContents = fs.readFileSync(path, 'utf-8');
        const bodyContentRefexp = /<body.*?>(.*?)<\/body>/ms;
        const res = bodyContentRefexp.exec(fileContents);
        const bodyContent = res ? res[1] : '';

        const footerRegexp = /<br><br><br>\s*<b><a href="\/prolog">.*$/gms;
        const stylesheetRegexp = /<link.*?>/gm;
        const imageRegexp = /<img.*?>/gm;
        const titleRegexp = /.*<\/h1>\s*<\/center>\s*<br>/gms;
        let finalContents = bodyContent
            // .replace(titleRegexp, '')
            .replace(/^\s*(<br>\s*)*/, '')
            .replace(footerRegexp, '')
            .replace(stylesheetRegexp, '')
            .replace(/((?:href|src)\=\")(?!http)(\/?)(.*?\")/gm, '$1https://www.metalevel.at/prolog/$3')
            // .replace(imageRegexp, '')
            .replace(/margin\-left\: .+?%\;?/gm, '')
            .replace(/style\=\".*?float\:.*?"/gm, '');

        if (path.endsWith('/prolog.html')) {
            finalContents = finalContents
                .replace(/<div.*?<ol.*?<br><br>/gms, '')
                .replace(/<br><br><br><br>.*/gms, '');
        }

        fs.writeFileSync(path, finalContents.trim(), 'utf-8');
        console.log(`Cleaned and saved: ${path}`);
    } catch (error) {
        process.exit(1);
    }
}

function generateCoverImage() {
    // Final image dimensions
    const width = 500;
    const height = 800;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background gradient (soft cream to white)
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#fdfcf9');
    gradient.addColorStop(1, '#ffffff');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Center
    const centerX = width / 2;

    // Author name
    ctx.fillStyle = '#222';
    ctx.textAlign = 'center';
    ctx.font = '18px serif';
    ctx.fillText('Markus Triska', centerX, 60);

    // === Horn Clause Logo ===
    // Instead of drawing an abstract scale we now render a symbolic form of a definite Horn clause:
    //    H ← B₁ ⋀ B₂ ⋀ B₃
    ctx.fillStyle = '#000';
    // Using a cool, elegant font
    ctx.font = 'bold 28px Georgia';
    // Positioned in the gap between the author and the title
    ctx.fillText('H ← B₁ ⋀ B₂ ⋀ B₃', centerX, 170);

    // === Title ===

    // "The"
    ctx.fillStyle = '#111';
    ctx.font = 'italic 30px serif';
    ctx.fillText('The', centerX, 240);

    // "POWER"
    ctx.font = 'bold 60px sans-serif';
    ctx.fillText('POWER', centerX, 300);

    // "of"
    ctx.font = 'italic 28px serif';
    ctx.fillText('of', centerX, 340);

    // "PROLOG"
    ctx.font = 'bold 50px sans-serif';
    ctx.fillText('PROLOG', centerX, 400);

    // Decorative line
    ctx.beginPath();
    ctx.moveTo(centerX - 80, 420);
    ctx.lineTo(centerX + 80, 420);
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // === Footer ===
    ctx.fillStyle = '#444';
    ctx.font = '16px sans-serif';
    ctx.fillText('© 2005–2025 Markus Triska', centerX, height - 60);
    ctx.fillText('https://www.metalevel.at/prolog', centerX, height - 30);

    // Save to file
    const buffer = canvas.toBuffer('image/png');
    const outputPath = path.join(OUTPUT_DIR, 'prolog_cover.png');
    fs.writeFileSync(outputPath, buffer);

    console.log('Image saved as prolog_cover.png');
}

function copyHtmlFiles(entries: TocEntry[]): void {
    try {
        console.log('Copying files...');
        const inputDir = path.join(__dirname, '../../',);

        for (const entry of entries) {
            const inputFilePath = path.join(inputDir, entry.url);
            const outputFilePath = path.join(OUTPUT_DIR, entry.url);

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

function generateToc(): TocEntry[] {
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

        return validatedEntries;

    } catch (error) {
        console.error('Error generating table of contents:', error);
        process.exit(1);
    }
}

export type TocEntry = {
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
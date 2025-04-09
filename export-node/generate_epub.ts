import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateEpub(): Promise<void> {
    const { EPub } = await import('@lesjoursfr/html-to-epub');

    console.log(__dirname);

    const htmlDir = path.join(__dirname, '../../', 'tmp');
    const epubPath = path.join(__dirname, '../../', 'exports', 'the-power-of-prolog.epub');

    let contents: {
        title: string;
        data: string;
    }[] = [];

    // Check if the directory exists
    if (fs.existsSync(htmlDir)) {
        // Read all files in the directory
        const files = fs.readdirSync(htmlDir, { recursive: true });

        // Process each file
        for (const file of files) {
            const filePath = path.join(htmlDir, file.toString());
            if (fs.existsSync(filePath) && fs.lstatSync(filePath).isFile()) {
                const title = filePath.replace('.html', '');
                const content = fs.readFileSync(filePath, 'utf-8');
                contents.push({
                    title: title,
                    data: content
                });
                console.log(`Added content from: ${filePath}`);
            }
        }
    } else {
        console.log(`HTML directory ${htmlDir} does not exist.`);
    }

    const options = {
        title: 'The Power of Prolog',
        author: 'Markus Triska',
        content: contents,
        description: 'The Power of Prolog is a collection of Prolog programs and their explanations.',
    }

    try {
        const epub = new EPub(options, epubPath);
        await epub.render();
        console.log(`EPUB file generated successfully at: ${epubPath}`);
    } catch (error) {
        console.error('Failed to generate EPUB:', error);
        throw error;
    }
}

// Run the function
generateEpub()
    .then(() => {
        console.log('EPUB generation completed successfully.');
    })
    .catch((error) => {
        console.error('Error during EPUB generation:', error);
    });
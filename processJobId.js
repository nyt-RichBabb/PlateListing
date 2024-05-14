const xml2js = require('xml2js');
const fs = require('fs');
const path = require('path');

const JobId = process.argv[2];

if (!JobId) {
    console.error('Please provide the JobId as a command-line argument.');
    process.exit(1);
}

const jobFilePath = path.join(__dirname, 'jobs', `${JobId}.xml`);

fs.readFile(jobFilePath, (err, data) => {
    if (err) throw err;

    xml2js.parseString(data, (err, result) => {
        if (err) throw err;

        const jdfDescriptiveName = result.JDF.$.DescriptiveName;
		
		const Bpub = extractBpub(jdfDescriptiveName);


	console.log(`${jdfDescriptiveName} - ${Bpub}\n`);

        const newDirPath = path.join(__dirname, 'public', jdfDescriptiveName);
        fs.mkdirSync(newDirPath, { recursive: true });

        const runLists = result.JDF.JDF[0].ResourcePool[0].RunList;
        processRunList(runLists, newDirPath, Bpub);
    });
});

function extractBpub(descriptiveName) {
    const startIndex = 6; // Starting from the 7th character (indexing starts from 0)
    const endIndex = descriptiveName.indexOf('_'); // Find the index of '_'
    if (endIndex > startIndex) {
        return descriptiveName.substring(startIndex, endIndex);
    }
    return ''; // Return empty string if '_' is not found or is before the 7th character
}

function getUpdatedPageLabelPrefix(Bpub, originalPageLabelPrefix) {
    const translationFilePath = path.join(__dirname, 'PrefixTranslation.txt');

    if (fs.existsSync(translationFilePath)) {
        const translations = fs.readFileSync(translationFilePath, 'utf8').split('\n');

        for (let line of translations) {
            const parts = line.split(' ');
            if (parts[0] === Bpub && parts[1] === originalPageLabelPrefix) {
                return parts[2] || originalPageLabelPrefix; // Return the third column value or the original prefix if the third column is empty
            }
        }
    }

    return originalPageLabelPrefix; // Return the original prefix if no translation is found
}


function processRunList(runLists, dirPath, Bpub) {
    runLists.forEach((runList) => {
        const descriptiveNameExists = runList.$ && runList.$.DescriptiveName;
        const pageLabelPrefixExists = 
            runList.LayoutElement && 
            runList.LayoutElement[0].PageList && 
            runList.LayoutElement[0].PageList[0].PageData && 
            runList.LayoutElement[0].PageList[0].PageData[0].$ && 
            runList.LayoutElement[0].PageList[0].PageData[0].$.PageLabelPrefix;

        if (descriptiveNameExists && pageLabelPrefixExists) {
            const descriptiveNameRaw = runList.$.DescriptiveName;
            const formattedDescriptiveName = formatDescriptiveName(descriptiveNameRaw);

            let pageLabelPrefix = runList.LayoutElement[0].PageList[0].PageData[0].$.PageLabelPrefix.substring(1); // Strip the first character
            pageLabelPrefix = getUpdatedPageLabelPrefix(Bpub, pageLabelPrefix); // Update PageLabelPrefix based on translation file

            runList.LayoutElement[0].SeparationSpec.forEach((separationSpec) => {
                const fileName = `${pageLabelPrefix}-${formattedDescriptiveName}.${separationSpec.$.Name}`;
                const filePath = path.join(dirPath, fileName);
                fs.writeFileSync(filePath, '');
                console.log(`File created: ${Bpub} -  ${filePath}`);
            });
        }

        if (runList.RunList) {
            processRunList(runList.RunList, dirPath, Bpub);
        }
    });
}

function formatDescriptiveName(descriptiveName) {
    const [, numericPart = '', alphaPart = ''] = descriptiveName.match(/^(\d*)(\D*)/) || [];
    // Calculate padding based on the total length of numeric and alpha parts
    const totalLength = 3 - alphaPart.length;
    const paddedNumericPart = numericPart.padStart(totalLength, '0');
    return `${paddedNumericPart}${alphaPart}`;
}

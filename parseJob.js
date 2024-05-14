const xml2js = require('xml2js');
const fs = require('fs');
const path = require('path');  // Importing path module

fs.readFile('test.xml', (err, data) => {
    if (err) throw err;

    xml2js.parseString(data, (err, result) => {
        if (err) throw err;

        // Format and Get JDF DescriptiveName
        const jdfDescriptiveName = formatDescriptiveName(result.JDF.$.DescriptiveName);

        // Log JDF DescriptiveName to the screen
        console.log(`${jdfDescriptiveName}\n`);

        // create a directory under relative path "public" named "${jdfDescriptiveName}"
        const newDirPath = path.join(__dirname, 'public', jdfDescriptiveName);
        fs.mkdirSync(newDirPath, { recursive: true });

        // Process RunList
        const runLists = result.JDF.JDF[0].ResourcePool[0].RunList;
        processRunList(runLists, newDirPath);  // Passing the new directory path to the function
    });
});

function processRunList(runLists, dirPath) {
    runLists.forEach((runList) => {
        const descriptiveNameExists = runList.$ && runList.$.DescriptiveName;
        const pageLabelPrefixExists = 
            runList.LayoutElement && 
            runList.LayoutElement[0].PageList && 
            runList.LayoutElement[0].PageList[0].PageData && 
            runList.LayoutElement[0].PageList[0].PageData[0].$ && 
            runList.LayoutElement[0].PageList[0].PageData[0].$.PageLabelPrefix;

        if (descriptiveNameExists && pageLabelPrefixExists) {
            const descriptiveName = formatDescriptiveName(runList.$.DescriptiveName);
            const pageLabelPrefix = runList.LayoutElement[0].PageList[0].PageData[0].$.PageLabelPrefix;

            runList.LayoutElement[0].SeparationSpec.forEach((separationSpec) => {
                // create an empty file named "${pageLabelPrefix}-${descriptiveName}.${separationSpec.$.Name}" under "${jdfDescriptiveName}" directory.
                const fileName = `${pageLabelPrefix}-${descriptiveName}.${separationSpec.$.Name}`;
                const filePath = path.join(dirPath, fileName);
                fs.writeFileSync(filePath, '');  // Creating an empty file
                console.log(`File created: ${filePath}`);
            });
        }

        // Recursively process nested RunList entries if they exist
        if (runList.RunList) {
            processRunList(runList.RunList, dirPath);  // Passing the directory path to the recursive call
        }
    });
}

// Helper function to format DescriptiveName
function formatDescriptiveName(descriptiveName) {
    // Pad with leading zeros only if the length is less than 3
    return descriptiveName.length < 3 ? descriptiveName.padStart(3, '0') : descriptiveName;
}

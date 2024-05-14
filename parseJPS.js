const fs = require('fs');
const xml2js = require('xml2js');

// Read the XML file
const xml = fs.readFileSync('tmp/jps.xml', 'utf-8');

// Parse the XML
xml2js.parseString(xml, (err, result) => {
  if (err) {
    console.error('Error parsing XML:', err);
    return;
  }

  // Access the Jobs element
  const jobs = result.Jobs;

  // Access individual Job elements
  const jobElements = jobs.Job;

  if (Array.isArray(jobElements)) {
    // If there are multiple Job elements
    jobElements.forEach((job) => {
      const jobId = job.$.JobId;
      const pubDate = job.$.PubDate;
      const jobName = job.$.JobName;
	  const Product = job.$.Product;
      console.log(`${jobId}, ${pubDate}, ${Product}, ${jobName}`);
    });
  } else if (jobElements) {
    // If there's only one Job element
    const jobId = jobElements.$.JobId;
    const pubDate = jobElements.$.PubDate;
    const jobName = jobElements.$.JobName;
	const Product = jobElements.$.Product;
    console.log(`${jobId}, ${pubDate}, ${Product}, ${jobName}`);
  } else {
    console.error('No Job elements found in the XML.');
  }
});

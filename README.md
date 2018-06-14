# Crittr
> High performance critical css extraction with a great configuration abilities.
> Crittr uses puppeteer as lower layer to extract the critical path stylesheet rules of a single or multiple urls. Multiple urls are the unique selling point of this library due to the fact that nearly every website using one css file for multiple sub pages. Now you are able to gather the critical css of all pages in one extracting process. And this faster than any other library! :muscle:

#### Feature Facts
* Faster than other libraries doing similar work (factor 4x)
* Designed to be used by power users as a nodejs module (no useless browser usage)
* :boom: **Only library which is able to extract summarized critical css from multiple urls which has a common use case -> Most of the websites using one css file for multiple subpages** :boom: :metal:
* When using multiple urls a max concurrency of extraction is adjustable. For machines with less power
* Ongoing maintenance because of being used in enterprise environment

## Performance
To determine the performance compared to the competitors a benchmark test was created. To achieve the results the benchmark uses a set of 20 urls for one css file. This is repeated for every library. Due to the fact that crittr was build to handle multiple urls it has an obvious advantage. Nevertheless the other libraries like penthouse or critical (uses penthouse) are also fast in single processing. But I would say this will not be a common use case anymore. :no_good:

[[https://raw.githubusercontent.com/hummal/crittr/master/docs/img/crittr_benchmark.png|alt=Benchmark]]

## Getting Started
### Requirements
Due to some dependecies of Crittr you may need to install some additional software.
Puppeteer has some special requirements if you are running on an UNIX based operation system. You can read more about this fact here. Including a list of what to install: [Puppeteer Troubleshooting](https://github.com/GoogleChrome/puppeteer/blob/master/docs/troubleshooting.md#chrome-headless-doesnt-launch)

### Installation
To use Crittr as a module or cli in your nodejs environment just install it with
```
npm i crittr
```
### Usage
#### Modul usage
To use Crittr as a module just require it and choose your options

##### Basic
```javascript
const Crittr = require('crittr');

Crittr({
    urls:   [
        "https://github.com/"
    ],
    css:`.header-logo-invertocat {
            margin: -1px 15px -1px -2px;
            color: #fff;
            white-space: nowrap;
        }`,
    device: {
        width:  1920,
        height: 1080
    }
}).then(extractedCss => {
    console.log(extractedCss);  
}).catch(err => {
    console.error(err);
});
```
As you can also read in the options section there is the possibility to use a css file as a path instead of a string. If the path provided ends with `.css` it is treated as a file path.
```javascript
const Crittr = require('crittr');

Crittr({
    urls:   [
        "https://github.com/"
    ],
    css: "./test/data/test.css"
}).then(extractedCss => {
        console.log(extractedCss);  
});
```
 
Due to the fact, that Crittr is returning a **Promise<String>** you can also use async/await syntax to handle the result.
```javascript
( async () => {
    const Crittr = require('crittr');
    try {
        const extractedCss = await Crittr({
                urls:   [
                    "https://github.com/"
                ],
                css: "./test/data/test.css"
            }); 
    } catch(err) {
        console.error(err);
    }
})();
```

##### Advanced - Multiple urls
To use the full power of Crittr and get the most of the performance advantage you should pass in multiple urls. As of the fact that the most websites use one css file for multiple pages this is the ultimate way to get the critical css for all of them!
```javascript
const Crittr = require('crittr');

const urls = [
    "https://example.com/page1",
    "https://example.com/page2",
    "https://example.com/about",
    "https://example.com/shop"
];

Crittr({
    urls:   urls,
    css: "./example.com/css/main.css"
}).then(extractedCss => {
        console.log(extractedCss);  
});
``` 

You can see the output of the time measurement after every run. So you will be able to check you overall processing time.

```
▶  Crittr Run Initialized timer...
◼  Crittr Run Timer run for: 2.33s
```

#### CLI Usage
The CLI usage is not implemented yet :scream:. At the moment there is no need of cli usage, but if you need it just open an issue and I will try to get it done! :heart:  

## Options
Property | Values | Description
---------| ------ | -----------
**css** | string | Can be a plain css string or path to a css file. If it is a path it has to end with `.css`! Otherwise it is not recognized as a path.
**urls** | Array | An array containing the urls to check the css against. Has to be at least 1 url.
timeout | Number | Optional. Integer number of milliseconds to wait for a page to navigate to. After timeout is reached the page navigation is aborted. **ATTENTION**: The critical css of the url timed out is not included. Default: 30000
pageLoadTimeout | Number | Optional. After the page load event is fired the pageLoadTimeout is started. After the amount of milliseconds the ongoing loading of assets or xhr requests is stoped and the extraction continues. Default: 2000
browser | Object | Optional. Configuration object of browser. E.g. userAgent, ... See documentation for browser object.
device | Object | Optional. Configuration object of device. E.g.  width, height, ... See documentation for device object.
puppeteer | Object | Optional. Configuration object of puppeteer options like an already existing browser instance or a path to a Chrome instead of the used Chromium. See documentation for puppeteer object.
printBrowserConsole | Boolean | Optional. If set to true prints console output of urls to the stdoutput. Defaults: false
dropKeyframes | Boolean | Optional. If set to false keeps keyframes as critical css content. Otherwise they are removed. Default: false
keepSelectors | Array | Optional. Every CSS Selector in this array will be kept as part of the critical css even if they are not part of it. Default: []
removeSelectors: | Array | Optional. Every CSS Selector in this array will be removed of the critical css even if they are part of it. Default: []
blockRequests | Array | Optional. Some of the requests made by pages are an

## FAQ :confused:
 - Why do I need to put my css file in when I only want to extract the critical css?
    You don't need to but if you don't set your css file as an option you may not receive all vendor prefixes you may expect. This is due testing with only one browser engine which drop other prefixes.

## Upcoming :trumpet:

- [ ] :star: wildcards
- [ ] :grey_question: positioning of critical css rules 
- [ ] :grey_question: multi selector partial matches ? needed?
- [ ] :broken_heart: page crash - recover url (page.url()) and retry

## Known Bugs :shit:
None yet

## Inspiration
:star: [puppeteer](https://github.com/GoogleChrome/puppeteer)
:star: [penthouse](https://github.com/pocketjoso/penthouse)
:star: [critical](https://github.com/addyosmani/critical)
:star: [criticalCSS](https://github.com/filamentgroup/criticalCSS)


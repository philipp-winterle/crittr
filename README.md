# crittr
> High performance critical css extraction library with a multiple url support. 
> crittr enables you to extract the critical path stylesheet rules of a single or multiple urls with lightning speed. Multiple urls are the unique selling point of this library due to the fact that nearly every website using one css file for multiple sub pages. Now you are able to gather the critical css of all pages in one extracting process. And this faster than any other library! :muscle:

#### Feature Facts
* Faster than other libraries doing similar work (factor 4x)
* Designed to be used by power users as a nodejs module (no useless browser usage)
* :boom: **Only library which is able to extract summarized critical css from multiple urls which has a common use case -> Most of the websites using one css file for multiple subpages** :boom: :metal:
* When using multiple urls a max concurrency of extraction is adjustable. For machines with less power
* Ongoing maintenance because of being used in enterprise environment

## Performance
To determine the performance compared to the competitors a benchmark test was created. To achieve the results the benchmark uses a set of 20 urls for one css file. This is repeated for every library. Due to the fact that crittr was build to handle multiple urls it has an obvious advantage. Nevertheless the other libraries like penthouse or critical (uses penthouse) are also fast in single processing. But I would say this will not be a common use case anymore. :no_good:

![Benchmark](/docs/img/crittr_benchmark.png)

To replay the benchmarks you can use the [benchmark example](https://github.com/hummal/crittr/blob/master/examples/benchmark.js) in this repository.

## Getting Started
### Requirements

- minimum nodejs > 7.6 | recommended nodejs 8+
  - async/await
  - Promises
- puppeteer dependecies on UNIX bases OS (including MacOSX)

> Due to some dependencies of crittr you may need to install some additional software.
> Puppeteer has some special requirements if you are running on an UNIX based operation system. You can read more about this fact here. Including a list of what to install: [Puppeteer Troubleshooting](https://github.com/GoogleChrome/puppeteer/blob/master/docs/troubleshooting.md#chrome-headless-doesnt-launch)


### Installation
To use crittr as a module or cli in your nodejs environment just install it with
```
npm i crittr
```
### Usage
#### Modul usage
To use crittr as a module just require it and choose your [options](#options).

The crittr module has the expects an object as input parameter and returns an array with 2 css strings. The first one is the criticalCss string and the second one is the remaining css without the critical selectors.

```javascript
// async/await
(async () => {
    const [criticalCss, restCss] = await crittr(options);
})();

// Promise
crittr(options).then( (criticalCss, restCss) => {
    // handle css
});

```

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
}).then(([criticalCss, restCss]) => {
    console.log(criticalCss);  
}).catch(err => {
    console.error(err);
});
```
As you can also read in the [options](#options) section there is the possibility to use a css file as a path instead of a string. If the path provided ends with `.css` it is treated as a file path.
```javascript
const Crittr = require('crittr');

Crittr({
    urls:   [
        "https://github.com/"
    ],
    css: "./test/data/test.css"
}).then(([criticalCss, restCss]) => {
        console.log(criticalCss);  
});
```
 
Due to the fact, that crittr is returning a **Promise<String>** you can also use async/await syntax to handle the result.
```javascript
( async () => {
    const Crittr = require('crittr');
    try {
        const [criticalCss, restCss] = await Crittr({
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
To use the full power of crittr and get the most of the performance advantage you should pass in multiple urls. As of the fact that the most websites use one css file for multiple pages this is the ultimate way to get the critical css for all of them!
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
}).then(([criticalCss, restCss]) => {
    // criticalCss contains all the above the fold css
    // restCss is the rest remaining after excluding the criticalCss.
    // You can start including it directly as a defered css without 
    // any need to calculate it on your own
        console.log(criticalCss);  
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

| Property | Values | Description |
|----------|--------|-------------|
| **css** | string | Can be a plain css string or path to a css file. If it is a path it has to end with `.css`! Otherwise it is not recognized as a path. |
**urls** | Array | An array containing the urls to check the css against. Has to be at least 1 url. |
| timeout | Number | Optional. Integer number of milliseconds to wait for a page to navigate to. After timeout is reached the page navigation is aborted. **ATTENTION**: The critical css of the url timed out is not included. Default: 30000 |
| pageLoadTimeout | Number | Optional. After the page load event is fired the pageLoadTimeout is started. After the amount of milliseconds the ongoing loading of assets or xhr requests is stopped and the extraction continues. Default: 2000 |
| browser | Object | Optional. Configuration object of browser. E.g. userAgent, ... See documentation for [browser object](#browser-options). |
| device | Object | Optional. Configuration object of device. E.g.  width, height, ... See documentation for [device object](#device-options). |
| puppeteer | Object | Optional. Configuration object of puppeteer options like an already existing browser instance or a path to a Chrome instead of the used Chromium. See documentation for [puppeteer object](#puppeteer-options). |
| printBrowserConsole | Boolean | Optional. If set to true prints console output of urls to the stdoutput. Defaults: false |
| dropKeyframes | Boolean | Optional. If set to false keeps keyframes as critical css content. Otherwise they are removed. Default: false |
| keepSelectors | Array | Optional. Every CSS Selector in this array will be kept as part of the critical css even if they are not part of it. Default: [] |
| removeSelectors: | Array | Optional. Every CSS Selector in this array will be removed of the critical css even if they are part of it. Default: [] |
| blockRequests | Array | Optional. Some of the requests made by pages are an |

### Browser options

| Property | Values | Description |
|----------|--------|-------------|
| userAgent | String | Optional. Can be set to any existing user agent |
| isCacheEnabled | Boolean | Optional. If set to false the browser will cache the result assets as normal behaviour. Default: true |
| isJsEnabled: | Boolean | Optional. If set to false the execution of Javascript in the browser page is prevented. Default: true |
| concurrentTabs | Number | Optional. Sets the maximal allowed concurrent tabs being opened at the same time in the browser. This is a useful option if the system has only low performance and to prevent high load. Default: 10 (Can also be set to "Infinity") |

### Device options

| Property | Values | Description |
|----------|--------|-------------|
| width | Number | Optional. Browser window width in px. Default: 1200 |
| height | Number | Optional. Browser window height in px. Default: 1080 |
| scaleFactor: | Number | Optional. Scaling factor of page. Only needed for mobile device emulation like iPhone. Default: 1 |
| isMobile | Boolean | Optional. If set to true the device type for checking pages is set to mobile. Default: false |
| isLandscape | Boolean | Optional. If set to true the device orientation is set to landscape. Default: false |
| hasTouch | Boolean | Optional. If set to true the device viewing the page is assumed having touch. Default: false |

### Puppeteer options

| Property | Values | Description |
|----------|--------|-------------|
| browser | Promise<Puppeteer Browser> | Optional. If you already have an puppeteer browser instance created you can use it with this options to prevent crittr from creating a new one. Just for performance!. Default: null |
| chromePath | String | Optional. Path to other Chrome or Chromium executable/bin file to use. . Default: Default Chromium shipped with puppeteer |
| headless: | Boolean | Optional. If set to false the browser will launch with GUI to be visible while processing. Default: true |


## FAQ :confused:
 - Why do I need to put my css file in when I only want to extract the critical css?
    You don't need to but if you don't set your css file as an option you may not receive all vendor prefixes you may expect. This is due testing with only one browser engine which drop other prefixes.

## Upcoming :trumpet:

- [ ] :star: cookie includes
- [ ] :star: wildcards
- [ ] :grey_question: positioning of critical css rules 
- [ ] :grey_question: multi selector partial matches ? needed?
- [ ] :broken_heart: page crash - recover url (page.url()) and retry

## Known Bugs :shit:
None yet

## Troubleshooting

### WSL / Windows Linux Subsystem Support
Some unkown reasons prevent puppeteer to run properly in a WSL environment. If you have any errors please try to use your default OS command shell or equivalent. If the error still exists don't hesitate to create an issue ticket.

## Inspiration
:star: [puppeteer](https://github.com/GoogleChrome/puppeteer)
:star: [penthouse](https://github.com/pocketjoso/penthouse)
:star: [critical](https://github.com/addyosmani/critical)
:star: [criticalCSS](https://github.com/filamentgroup/criticalCSS)

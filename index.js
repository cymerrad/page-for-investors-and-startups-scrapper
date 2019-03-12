"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const puppeteer_1 = __importDefault(require("puppeteer"));
const modeDebug = true;
const debug = (...args) => {
    if (modeDebug) {
        console.log(...args);
    }
};
const dimensions = {
    width: 1920,
    height: 1080
};
async function scrollDown(page, curHeight, downBy) {
    // add
    let height = curHeight + downBy;
    // 'instant' in opposition to 'smooth'
    await page.evaluate(`window.scrollTo({top: ${height}, behavior: 'instant'})`);
    // wait for site's potential javascript to notice the change and do it's thing with css
    await (async () => new Promise(resolve => setTimeout(resolve, 200)))();
    // site's height might have changed
    let pageHeight = await page.evaluate("document.body.scrollHeight");
    return [height, pageHeight];
}
const rowItemClass = "item column"; // this contains Company and Link
const rowItemLinkClass = "startup-link"; // [0] -> .href, [0] -> .title
const rowItemDescriptionClass = "blurb"; // [0] -> .innerText
const rowJoinedClass = "column joined"; // -> '.value' -> .innerText
const rowFollowersClass = "column followers"; // -> '.value' -> .innerText
function scrapeDataFromBatch(batch) {
    try {
        let rawData = Array.from(batch.children).map(row => {
            const itemCollection = row.getElementsByClassName(rowItemClass);
            const [item] = Array.from(itemCollection);
            const linkName = item.getElementsByClassName(rowItemLinkClass)[0];
            const link = linkName.href;
            const name = linkName.title;
            const descriptionElem = item.getElementsByClassName(rowItemDescriptionClass)[0];
            const description = descriptionElem.innerText;
            const joinedElem = row.getElementsByClassName(rowJoinedClass)[0];
            const joinedElem2 = joinedElem.getElementsByClassName("value")[0];
            const joined = joinedElem2.innerText;
            const followersElem = row.getElementsByClassName(rowFollowersClass)[0];
            const followersElem2 = followersElem.getElementsByClassName("value")[0];
            const followers = followersElem2.innerText;
            return {
                Company: name,
                Link: link,
                Description: description,
                Followers: followers,
                Joined: joined
            };
        });
        return rawData;
    }
    catch (_a) {
        return [];
    }
}
async function scrapeAllPossibleData(page) {
    // So angel.co works like this:
    // Every time you click button "More", another div is added to '.results_holder' element.
    // There is a limit on how many listings you can see, however.
    // When that is reached, every next batch of results added to '.results_holder' will contain no children.
    // So length of the last child of '.results_holder' will be our invariant.
    // We could also use the page height.
    const resultsHolderSelector = ".results_holder";
    const moreButtonSelector = ".more hidden";
    const loadingButtonSelector = ".loading_image";
    debug("Waiting for results_holder");
    await page.waitForSelector(resultsHolderSelector);
    const getLastChildData = (resultsSelector) => {
        const rowItemClass = "item column"; // this contains Company and Link
        const rowItemLinkClass = "startup-link"; // [0] -> .href, [0] -> .title
        const rowItemDescriptionClass = "blurb"; // [0] -> .innerText
        const rowJoinedClass = "column joined"; // -> '.value' -> .innerText
        const rowFollowersClass = "column followers"; // -> '.value' -> .innerText
        try {
            const [results] = document.querySelectorAll(resultsSelector);
            const last = Array.from(results.children).pop();
            if (last === undefined || last.children.length === 0) {
                console.log("Nothing found");
                return [];
            }
            let rawData = Array.from(last.children).map(row => {
                const itemCollection = row.getElementsByClassName(rowItemClass);
                const [item] = Array.from(itemCollection);
                const linkName = item.getElementsByClassName(rowItemLinkClass)[0];
                const link = linkName.href;
                const name = linkName.title;
                const descriptionElem = item.getElementsByClassName(rowItemDescriptionClass)[0];
                const description = descriptionElem.innerText;
                const joinedElem = row.getElementsByClassName(rowJoinedClass)[0];
                const joinedElem2 = joinedElem.getElementsByClassName("value")[0];
                const joined = joinedElem2.innerText;
                const followersElem = row.getElementsByClassName(rowFollowersClass)[0];
                const followersElem2 = followersElem.getElementsByClassName("value")[0];
                const followers = followersElem2.innerText;
                return {
                    Company: name,
                    Link: link,
                    Description: description,
                    Followers: followers,
                    Joined: joined
                };
            });
            return rawData;
        }
        catch (err) {
            console.log("Caught on fire", err);
            return [];
        }
    };
    let data = [];
    let height = 0;
    let lastBatch = await page.evaluate(getLastChildData, resultsHolderSelector);
    debug("Last batch", lastBatch);
    while (lastBatch && lastBatch.length > 0) {
        data.push(...lastBatch);
        // scroll to the bottom of the page first - in case of dynamic, 'infinite' loading
        // let pageHeight = await page.evaluate("document.body.scrollHeight");
        // while (height < pageHeight) {
        //   debug("Scrolling...");
        //   [height, pageHeight] = await scrollDown(page, height, dimensions.height);
        // }
        // click 'More'
        // await page.waitForSelector(moreButtonSelector);
        debug("Clicking 'More'");
        // await page.click(moreButtonSelector);
        // alternative to above
        await page.evaluate(buttonClassName => {
            let but = document.getElementsByClassName(buttonClassName)[0];
            but.click();
        }, "more hidden");
        debug("Waiting for loading to start");
        await page.waitForSelector(loadingButtonSelector);
        debug("Waiting for loading to end");
        await page.waitForSelector(loadingButtonSelector, { hidden: true });
        debug("Loaded more content");
        lastBatch = await page.evaluate(getLastChildData, resultsHolderSelector);
        debug("Last batch", lastBatch);
    }
    debug("Exiting the loop");
    // let pageHeight = await page.evaluate("document.body.scrollHeight");
    // let height = 0;
    // while (height < pageHeight) {
    //   [height, pageHeight] = await scrollDown(page, height, dimensions.height);
    // }
    return data;
}
(async () => {
    const browser = await puppeteer_1.default.launch({
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        headless: false
    });
    const page = await browser.newPage();
    await page.setViewport(dimensions);
    await page.goto("https://angel.co/blockchains", {
        waitUntil: "networkidle0"
    });
    try {
        let data = await scrapeAllPossibleData(page);
        console.log(data);
    }
    catch (err) {
        console.log("Error, screenshoting the page");
        await page.screenshot({
            path: `error_${new Date().getTime()}.png`,
            fullPage: true
        });
        console.log(err);
    }
})();

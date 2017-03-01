var hitMap = {};
var hitMapFilingId = {};

function drillDownOnException(allExceptions, exception, depth)
{

    var idTxt = exception._id + "";
    var exceptionTxt = exception._source.exception + "";
    var appTxt = exception._source.app + "";
    var urlsInException = getRequest(exceptionTxt);

    //console.log("ID:" + idTxt);

    var linkedExceptions = allExceptions.hits.hits.filter(function (hit)
    {

        if (urlsInException === null) return false;

        for (var i = 0; i < urlsInException.length; i++)
        {
            if (hit._source.message.indexOf(urlsInException[i]) !== -1 && hit._source.app != appTxt && hit._id != idTxt) return true;
        }

        return false;

    });

    var linkedExceptionsCount = linkedExceptions.length;

    //console.log(linkedExceptionsCount);

    if (linkedExceptionsCount > 0 && depth < 5)
    {
        // Here we should really get the closest related exception time-wise, rather than just getting the first.
        return drillDownOnException(allExceptions, linkedExceptions[0], depth + 1);// + "\n" + resTxt;
    }
    else
    {
        return idTxt;
    }


}

function analyseExceptions(json)
{
    var parsedJson = JSON.parse(json);
    var frontendExceptions = parsedJson.hits.hits.filter(function (hit)
    {
        return hit._source.app != "XXX";
    });


    //alert(frontendExceptions.length);

    var hitCount = frontendExceptions.length;

    for (i = 0; i < hitCount; i++)
    {

        var res = drillDownOnException(parsedJson, frontendExceptions[i], 0);

        var resultingException = parsedJson.hits.hits.filter(function (hit)
        {
            return hit._id == res;
        });

        var exception = resultingException[0];

        var causedByRegEx = /Caused by: .+/g;

        var idTxt = exception._id + "";
        var messageTxt = exception._source.message + "";
        var exceptionTxt = exception._source.exception + "";
        var appTxt = exception._source.app + "";
        var urlsInException = getRequest(exceptionTxt);
        var causedBy = exceptionTxt.match(causedByRegEx);
        var session = exception["x-session-id"];

        var reportTxt = "";

        if (causedBy !== null)
        {
            reportTxt = causedBy[causedBy.length - 1];
        }
        else
        {
            reportTxt = exceptionTxt.split("\n")[0];
        }

        reportTxt = reportTxt.replace("\n", "").replace("\r", "");

        reportTxt = reportTxt.replace(/([0-9a-z]{24})/g, "*"); //filing Id
        reportTxt = reportTxt.replace(/[A-Z]{2}[0-9]{6}[A-Z]{0,1}/g, "*"); // NINO
        reportTxt = reportTxt.replace(/[0-9]{3}\/[A-Z]{1,2}[0-9]{4,5}/g, "*"); // ???
        reportTxt = reportTxt.replace(/[0-9]+/g, "*"); // UTR


        var filingId1 = messageTxt.match(/([0-9a-z]{24})/g);
        var filingId2 = exceptionTxt.match(/([0-9a-z]{24})/g);
        var utr1 = messageTxt.match(/([0-9]{10})/g);
        var utr2 = exceptionTxt.match(/([0-9]{10})/g);

        messageTxt = messageTxt.replace(/([0-9a-z]{24})/g, "*"); //filing Id
        messageTxt = messageTxt.replace(/[A-Z]{2}[0-9]{6}[A-Z]{0,1}/g, "*"); // NINO
        messageTxt = messageTxt.replace(/[0-9]{3}\/[A-Z]{1,2}[0-9]{4,5}/g, "*"); // ???
        messageTxt = messageTxt.replace(/(@[0-9a-z]{9})/g, "*"); // log entry id
        messageTxt = messageTxt.replace(/[0-9]+/g, "*"); // UTR

        //messageTxt = "XXX";

        //NR946941D

        var firstBracketPos = reportTxt.indexOf("(");

        if (firstBracketPos != -1) reportTxt = reportTxt.substring(0, firstBracketPos);

        addToMap(appTxt + " ---" + reportTxt + " ---" + messageTxt);

        if (filingId1 || utr1 || filingId2 || utr2 || session)
        {
            addToMapFilingId(appTxt + " ---" + reportTxt + " ---" + messageTxt, filingId1 || utr1 || filingId2 || utr2 || session);
        }
    }

    sortOutput(hitMap);

    //alert("end");

}

function sortOutput(sortme)
{
    var keys = [];
    for (var key in sortme)
    {
        keys.push(key);
    }

    keys.sort(function (k0, k1)
    {
        var a = sortme[k0];
        var b = sortme[k1];
        return a < b ? -1 : (a > b ? 1 : 0);
    });

    //var newTable = document.createElement('table');
    var newTable = "<TABLE class='table table-condensed'><TH>Count</TH><TH>Filing IDs / UTRs affected</TH><TH>Service</TH><TH>Exception</TH><TH>Message</TH>";
    //document.body.appendChild(elemDiv);

    for (var i = keys.length - 1; i >= 0; --i)
    {
        var key = keys[i];
        var filingIdCnt = "unknown";
        if (hitMapFilingId[key] !== undefined) filingIdCnt = hitMapFilingId[key].length;
        var value1 = sortme[key];
        var service = key.split("---")[0];
        var exception = key.split("---")[1];
        var message = key.split("---")[2];
        //console.log(value1 + " - " + key);
        newTable = newTable + "<TR><TD class='numeric-value'>" + value1 + "</TD><TD class='cell-hover ng-scope'>" + filingIdCnt + "</TD><TD class='cell-hover ng-scope'>" + service + "</TD><TD class='cell-hover ng-scope'>" + exception + "</TD><TD class='cell-hover ng-scope'>" + message + "</TD></TR>";
    }

    newTable = newTable + "</TABLE>";

    document.querySelector("div[ng-if=spy\\.mode\\.name\\ \\=\\=\\=\\ \\\'response\\\']").innerHTML = newTable;
}

function getRequest(myString)
{

    var request = myString.match(/GET of '.+?'|PUT of '.+?'|POST of '.+?'/g);

    if (!request)
    {
        return null;
    }

    for (var i = 0; i < request.length; i++)
    {
        request[i] = request[i].replace("GET of '", "");
        request[i] = request[i].replace("PUT of '", "");
        request[i] = request[i].replace("POST of '", "");
        request[i] = request[i].replace("'", "");
        request[i] = request[i].replace(/http:\/\/[a-z\-]+.service\//g, "");
        request[i] = request[i].replace(/http:\/\/[a-z\-]+.service:80\//g, "");
    }

    return request;
}


function addToMap(messageTxt)
{
    if (hitMap[messageTxt] === undefined)
    {
        hitMap[messageTxt] = 1;
    }
    else
    {
        hitMap[messageTxt] = hitMap[messageTxt] + 1;
    }
}

function addToMapFilingId(messageTxt, filingId)
{
    if (hitMapFilingId[messageTxt] === undefined)
    {
        hitMapFilingId[messageTxt] = [filingId];
    }
    else
    {
        if ((hitMapFilingId[messageTxt] + " ").indexOf(filingId) >= 0)
        {
            // do nothing
        }
        else
        {
            hitMapFilingId[messageTxt].push(filingId);
        }
    }
}

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse)
{
    if (msg.text !== "hackNSlashExceptions")
    {
        return;
    }

    var responseData = document.querySelector("div[ng-if=spy\\.mode\\.name\\ \\=\\=\\=\\ \\\'response\\\'] pre");
    if (!responseData)
    {
        console.warn("Sorry, dude. There's no suitable content on this page!");
        return;
    }

    analyseExceptions(responseData.innerText);
});
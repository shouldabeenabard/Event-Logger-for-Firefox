//window.addEventListener("load", function() { elf.startHeaderInfo(); }, false);
//window.addEventListener("load", function() { let stringBundle = document.getElementById("xulschoolhello-string-bundle"); let message = stringBundle.getString("xulschoolhello.greeting.label");window.alert(message); }, false);

if(!elf) var elf={};
if(!elf) elf={};

var Started=false,StartTime,StopTime,Finished;

elf.oHeaderInfo = null;

elf.startHeaderInfo = function() {
  
  elf.oHeaderInfo = new elf.HeaderInfo();
  elf.oHeaderInfo.start();
  elf.addToListener(elf.oHeaderInfo);
  
  //var prefManager = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
  set_cache_settings();
  
  perTabListener.start();
}

elf.stopHeaderInfo = function() {
  elf.removeFromListener(elf.oHeaderInfo)
  elf.oHeaderInfo.stop();
  elf.oHeaderInfo = null;
  
  perTabListener.start();
}

elf.addToListener = function(obj)
{
  // Register new request and response listener
  if ('nsINetModuleMgr' in Components.interfaces) {
    // Should be an old version of Mozilla/Phoenix (before september 15, 2003)
    var netModuleMgr = Components.classes["@mozilla.org/network/net-extern-mod;1"].getService(Components.interfaces.nsINetModuleMgr);
    netModuleMgr.registerModule("@mozilla.org/network/moduleMgr/http/request;1", obj);
    netModuleMgr.registerModule("@mozilla.org/network/moduleMgr/http/response;1", obj);
  } else {
    // Should be a new version of  Mozilla/Phoenix (after september 15, 2003)
    var observerService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
    observerService.addObserver(obj, "http-on-modify-request", false);
    observerService.addObserver(obj, "http-on-examine-response", false);
    observerService.addObserver(obj, "http-on-examine-cached-response", false);
    
    observerService.addObserver(obj, "network:offline-status-changed", false);
    var idleService = Components.classes["@mozilla.org/widget/idleservice;1"].getService(Components.interfaces.nsIIdleService);
    idleService.addIdleObserver(obj, 20); // JJJ: idle time in seconds
    observerService.addObserver(obj, "prefetch-load-requested", false);
    observerService.addObserver(obj, "prefetch-load-completed", false);
    //observerService.addObserver(obj, "sleep_notification", false);
    //observerService.addObserver(obj, "wake_notification", false);
  }
}
elf.removeFromListener = function(obj)
{
  // Unregistering listener
  if ('nsINetModuleMgr' in Components.interfaces) {
    // Should be an old version of Mozilla/Phoenix (before september 15, 2003)
    var netModuleMgr = Components.classes["@mozilla.org/network/net-extern-mod;1"].getService(Components.interfaces.nsINetModuleMgr);
    netModuleMgr.unregisterModule("@mozilla.org/network/moduleMgr/http/request;1", obj);
    netModuleMgr.unregisterModule("@mozilla.org/network/moduleMgr/http/response;1", obj);
  } else {
    // Should be a new version of  Mozilla/Phoenix (after september 15, 2003)
    var observerService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
    observerService.removeObserver(obj, "http-on-modify-request");
    observerService.removeObserver(obj, "http-on-examine-response");
    observerService.removeObserver(obj, "http-on-examine-cached-response");
    
    observerService.removeObserver(obj, "network:offline-status-changed");
    var idleService = Components.classes["@mozilla.org/widget/idleservice;1"].getService(Components.interfaces.nsIIdleService);
    idleService.removeIdleObserver(obj, 20);
    observerService.removeObserver(obj, "prefetch-load-requested");
    observerService.removeObserver(obj, "prefetch-load-completed");
    
    //observerService.removeObserver(obj, "sleep_notification");
    //observerService.removeObserver(obj, "wake_notification");
  }
}


/****************************************************************************
* Per-tab Listener
****************************************************************************/
const STATE_START=Components.interfaces.nsIWebProgressListener.STATE_START;
const STATE_STOP=Components.interfaces.nsIWebProgressListener.STATE_STOP;
const STATE_IS_DOCUMENT=Components.interfaces.nsIWebProgressListener.STATE_IS_DOCUMENT;
var perTabListener = {
  stopIsValid: new Boolean(false),
  
  start : function() {
    gBrowser.browsers.forEach(function (browser) {
      this._toggleProgressListener(browser.webProgress, true);
    }, this);
  
    gBrowser.tabContainer.addEventListener("TabOpen", this, false);
    gBrowser.tabContainer.addEventListener("TabClose", this, false);
  },
  
  stop : function() {
    gBrowser.browsers.forEach(function (browser) {
      this ._toggleProgressListener(browser.webProgress, false);
    }, this);
  
    gBrowser.tabContainer.removeEventListener("TabOpen", this, false);
    gBrowser.tabContainer.removeEventListener("TabClose", this, false);
  },
  
  handleEvent : function(aEvent) {
    let tab = aEvent.target;
    let webProgress = gBrowser.getBrowserForTab(tab).webProgress;
  
    this._toggleProgressListener(webProgress, ("TabOpen" == aEvent.type));
  },
  
  _toggleProgressListener : function(aWebProgress, aIsAdd) {
    if (aIsAdd) {
      aWebProgress.addProgressListener(this, aWebProgress.NOTIFY_ALL);
      //aWebProgress.addEventListener("load", elf.oHeaderInfo.linkTargetFinder, false);
    } else {
      aWebProgress.removeProgressListener(this);
    }
  },
  
  QueryInterface: function(iid){
    if(iid.equals(Components.interfaces.nsIWebProgressListener)||
      iid.equals(Components.interfaces.nsISupportsWeakReference)||
      iid.equals(Components.interfaces.nsISupports)){
       return this;
    }
    throw Components.results.NS_NOINTERFACE;
  },
  
  onStateChange: function(aWebProgress, aRequest, aFlags, aStatus){
    if(aFlags&STATE_START && aFlags&STATE_IS_DOCUMENT){
      // get the page load time
      aRequest.QueryInterface(Components.interfaces.nsIChannel);
      url = aRequest.originalURI.spec;
      if(url == "about:blank") {
        return 0;
      }
      
      // log the start event
      objectID = elf.oHeaderInfo.nextObjectID;
      elf.oHeaderInfo.nextObjectID++;
      var currTime = new Date;
      elf.oHeaderInfo.events[objectID] =
        new elf.EventObject(getUnixTime(currTime), elf.oHeaderInfo.windowID, objectID, url, "START_LOAD_PAGE");
    }
    if(aFlags&STATE_STOP && aFlags&STATE_IS_DOCUMENT){
      // get the page stop time
      aRequest.QueryInterface(Components.interfaces.nsIChannel);
      url = aRequest.originalURI.spec;
      
      
      if(url == "about:blank") {
        return 0;
      }
      
      // requeue cache prefetched links
      requeuePrefetchLinks();
      
      // log the stop event
      objectID = elf.oHeaderInfo.nextObjectID;
      elf.oHeaderInfo.nextObjectID++;
      var currTime = new Date;
      elf.oHeaderInfo.events[objectID] =
        new elf.EventObject(getUnixTime(currTime), elf.oHeaderInfo.windowID, objectID, url, "STOP_LOAD_PAGE");
      
      // call the link target finder
      aWebProgress.QueryInterface(Components.interfaces.nsIWebProgress);
      if(!aWebProgress.NS_ERROR_FAILURE) {
        this.linkTargetFinder(aWebProgress.DOMWindow);        
      }
    }
    return 0;
  },
  
 /****************************************************************************
 * Link target finder
 ****************************************************************************/
  linkTargetFinder: function (browsercontent) {
    // phase 1: no link highlighting
    if (elf.oHeaderInfo.experimentPhase == 1) {
      return;
    }
    
    // check if online, if so no link highlighting
    prefsService = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
    isOffline = prefsService.getBoolPref("browser.offline");
    if (!isOffline) {
      return;
    }
    
    var head = browsercontent.document.getElementsByTagName("head")[0],
      style = browsercontent.document.getElementById("link-target-finder-style"),
      allTags = browsercontent.document.getElementsByTagName("a"),
      foundLinks = 0;
    
    if (!style) {
      style = browsercontent.document.createElement("link");
      style.id = "link-target-finder-style";
      style.type = "text/css";
      style.rel = "stylesheet";
      style.href = "chrome://eventlogger/skin/browserOverlay.css";
      head.appendChild(style);
    }

    for (var i=0, il = allTags.length; i < il; i++) {
      currentTag = allTags[i];
      href = currentTag.getAttribute("href");
      if (href && (href != "")) {
        // check if its in the cache
        href = ff_GetAbsoluteUrl(href, browsercontent.document.URL);
        //href = elf.oHeaderInfo.getMovedLocation(href);
        if (getCachedSize(href) > -1) {
          //currentTag.className += ((currentTag.className.length > 0) ? " " : "") + "link-target-finder-selected";
          currentTag.className += ((currentTag.className.length > 0) ? " " : "") + "external";
          foundLinks++; // JJJ: log the number of links displayed?
        }
      }
    }
    
    /*
    // XXX: log how many links were found (might be too much info if this is run on a timer)
    objectID = elf.oHeaderInfo.nextObjectID;
    elf.oHeaderInfo.nextObjectID++;
    var currTime = new Date;
    elf.oHeaderInfo.events[objectID] =
      new elf.EventObject(getUnixTime(currTime), elf.oHeaderInfo.windowID, objectID, browsercontent.document.URL, "HIGHLIGHTED_LINKS");
    */
    /*
    if (foundLinks === 0) {
      alert("No links found with a target attribute");
    }
    else {
      alert("Found " + foundLinks + " links with a target attribute");
    }*/
  },
  
  onLocationChange:function(d,e,f){
    return 0;
  },
  
  onProgressChange:function(){
    return 0;
  },
  
  onStatusChange:function(){
    return 0;
  },
  
  onSecurityChange:function(){
    return 0;
  },
  
  onLinkIconAvailable:function(){
    return 0;
  }
}

function getUnixTime(date){
  var unixtime = 0;
  if(date && date instanceof Date) {
    var unixtime_ms = date.getTime(); // Returns milliseconds since the epoch
    var unixtime = parseInt(unixtime_ms / 1000);
  }
  else {
    alert("broken date");
  }
  return unixtime;
}

  /****************************************************************************
  * Event Object Definition
  ****************************************************************************/
elf.EventObject = function(eventtime, windowid, id, url, eventcode)
{
  this.timestamp = eventtime;
  this.windowID = windowid;
  this.ID = id;
  this.URL = url;
  this.eventCode = eventcode;
  
  this.data = new Array();
}
elf.EventObject.prototype =
{
  rows: 0,
  SEPSTRING: "\r\n",
  
  // add request/response headers
  addHeaders: function(headers) {
    var flag = false;
    for (i in headers) {
      if(flag) {
        //this.addRow(i + ": " + headers[i] + "\r\n");
        if (i == "Referer" ||
            i == "Content-Length" ||
            i == "Content-Type" ||
            //i == "Date" ||
            i == "X-Moz") { // mozilla prefetch header
          this.addRow(i + ": " + headers[i] + "\r\n");
        }
      }
      else {
        this.addRow(headers[i] + "\r\n"); //always allow first header through HTTP version/ response
        flag=true;
      }
      //this.addRow((flag ? i + ": " : "") + headers[i] + "\r\n");
    }
  },
  
  // add a row to the request or response headers
  addRow: function(row) {
    this.rows = this.data.push(row);
  },
  
  // get the request headers
  getString: function(){
    data = "";
    data += this.timestamp.toString() + " ";
    data += this.windowID.toString() + " ";
    data += this.ID.toString() + " ";
    data += this.URL + " ";
    data += this.eventCode + "\r\n";
    
    // XXX: this isn't strictly correct since the cache entry could have been evicted/replaced
    // XXX: but it should be ok since the update time is set to about a minute.
    // prior to saving update the content-length if it doesn't exist
    /*
    if(this.eventCode == "RESPONSE") {
      var fileSize = this.getHeaderValue(false, "Content-Length");
      if (!fileSize) {
        cachedFileSize = getCachedSize(this.URL);
        if(cachedFileSize > -1) {
          this.addRow(false, "Content-Length: " + cachedFileSize + "\r\n");        
        }
      }
    }*/
    
    // JJJ: just add the data rows if they exist
    // get request/response/cached data rows
    //if((this.eventCode == "REQUEST") ||
    //   (this.eventCode == "RESPONSE") ||
    //   (this.eventCode == "CACHED")) {
      data += this.getData();
    //}
    data += this.SEPSTRING;
    return data;
  },
  
  getData: function() {
    var data = "";
    for (var row = 0; row < this.rows; row++) {
      data += this.data[row];
    }      
    return data;
  },
  
    // get the value of a http header with the given key
  getHeaderValue: function(key)
  {
    key = key.toLowerCase()
    var data = null;
    for (var row = 0; row < this.rows; row++) {
      var line = this.data[row].toLowerCase();
      if (line.indexOf(key + ":") == 0) {
        data = line.substring(key.length + 1); // XXX: probably also need to trim the string
        break;
      }
    }      
    return data;
  }
}

/****************************************************************************
* HeaderInfo Main Extension Object
****************************************************************************/
elf.HeaderInfo = function()
{
  this.data = new Array(); //Data for each row
  this.events = new Array();
  this.oldevents = new Array();
  this.observers = new Array(); // elf's Observers
  this.movedLocationMap = new Array();

  // Read preferences
  this.pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
  this.lpref = this.pref.getBranch("extensions.elf."); // ELF

/*
  // XXX: Debug reset prefs
  this.setIntPref(this.lpref, "nextWindowID", 0);
  this.setIntPref(this.lpref, "nextObjectID", 0);
  this.setIntPref(this.lpref, "lastAckedObjectID", -1);
*/
  this.machineID = this.getIntPref(this.lpref, "machineID", -1); // default to -1
  this.windowID = this.getIntPref(this.lpref, "nextWindowID", 0); // default to 0
  this.oldWindowID = this.windowID; // for previously loaded window sessions
  this.setIntPref(this.lpref, "nextWindowID", this.windowID+1);
  this.nextObjectID = 0;
  this.lastAckedObjectID = -1;
  this.experimentPhase = this.getIntPref(this.lpref, "experimentPhase", 1); // default to 2 for prefetch BFS
  this.version = 0.2; // needs to match the one in the install.rdf
}
elf.HeaderInfo.prototype =
{
  rows: 0,

//  LOGSERVER: "http://216.165.108.87:80", // beaker-7
//  LOGSERVER: "http://216.165.108.94:80", // beaker-14
  LOGSERVER: "http://192.168.2.2:8081", // server box
//  LOGSERVER: "http://localhost:8080",
  
  oDump: null,
  isCapturing: true,

  start : function()
  {
    this.loadLogs();
    startTimer(this);
  },
  
  stop : function()
  {
    stopTimer(this);
    this.saveLogs();
  },
  QueryInterface: function(iid) {
    if (!iid.equals(Components.interfaces.nsISupports) &&
        !iid.equals(Components.interfaces.nsIHttpNotify) &&
        //!iid.equals(Components.interfaces.nsIClassInfo) &&
        //!iid.equals(Components.interfaces.nsISecurityCheckedComponent) &&
        //!iid.equals(Components.interfaces.nsIWeakReference) &&
        //!iid.equals(Components.interfaces.nsIHttpNotify) &&
        !iid.equals(Components.interfaces.nsIObserver)) {
          //dump("elf: QI unknown iid: " + iid + "\n");
          throw Components.results.NS_ERROR_NO_INTERFACE;
    }
    return this;
  },
  
    
  /****************************************************************************
  * Logging/state
  ****************************************************************************/
  saveLogs : function ()
  {
    try {
      // get extensions file path
      const id = "jchen@cs.nyu.edu";
      var extension = Components.classes["@mozilla.org/extensions/manager;1"]
      .getService(Components.interfaces.nsIExtensionManager)
      .getInstallLocation(id)
      .getItemLocation(id);
      
      // netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");
      
      // create proper path for xml file
      var uncommittedLogFile = extension.path + "\\" + "uncommitted.log";
      // create component for file writing
      var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
      file.initWithPath( uncommittedLogFile );
      //alert("creating file... " + uncommittedLogFile);
      if(file.exists() == false) //check to see if file exists
      {
        file.create( Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 420);
      }
      
      // create file output stream and use write/create/truncate mode
      // 0x02 writing, 0x08 create file, 0x20 truncate length if exist JJJ: changed to append 0x10
      var stream = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
      stream.init(file, 0x02 | 0x08 | 0x10 /* 0x20*/, 0666, 0);
      
      // write data to file then close output stream
      // old data logs
      var data = this.getOldLogs();
      stream.write(data, data.length);
      
      // new data logs
      var data = this.getLogs(this.lastAckedObjectID);
      stream.write(data, data.length);
      
      stream.close();
    }
    catch (ex) {
      alert(ex);
    }
  },
  loadLogs : function ()
  {
    try {
      // get extensions file path
      const id = "jchen@cs.nyu.edu";
      var extension = Components.classes["@mozilla.org/extensions/manager;1"]
      .getService(Components.interfaces.nsIExtensionManager)
      .getInstallLocation(id)
      .getItemLocation(id);
      
      // netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");
      
      // create proper path for xml file
      var uncommittedLogFile = extension.path + "\\" + "uncommitted.log";
      // create component for file writing
      var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
      file.initWithPath( uncommittedLogFile );
      if(file.exists() == false) //check to see if file exists
      {
        file.create( Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 420);
      }
      
      // create file output stream and use write/create/truncate mode
      // 0x02 writing, 0x08 create file, 0x20 truncate length if exist
      var stream = Components.classes["@mozilla.org/network/file-input-stream;1"].createInstance(Components.interfaces.nsIFileInputStream);
      stream.init(file, 0x01, 0444, null);
      
      var sstream = Components.classes["@mozilla.org/scriptableinputstream;1"].createInstance(Components.interfaces.nsIScriptableInputStream);
      sstream.init(stream);

      var eventEntriesRead = 0;
      var requestEntriesRead = 0;
      var responseEntriesRead = 0;
      var initEntry = false;
      var currentEntry = null;
      var data = sstream.read(sstream.available());
      lines = data.split("\r\n");
      for (i in lines) {
        line = ff_trimString(lines[i]);
        if(line.length > 0) {
          if(initEntry == false) {
            initEntry = true;
            // parse the line
            chunks = line.split(" ");
            if(chunks.length == 5) {
              reqTime = parseInt(chunks[0]);
              reqWindowID = parseInt(chunks[1]);
              reqID = parseInt(chunks[2]);
              reqURL = chunks[3];
              reqOp = chunks[4];
              
              this.oldevents[reqID] = new elf.EventObject(reqTime, reqWindowID, reqID, reqURL, reqOp);
              currentEntry = this.oldevents[reqID];
              currentEntry.timestamp = reqTime;
              if((reqOp == "REQUEST")) {
                requestEntriesRead++;                  
              }
              else if ( (reqOp == "RESPONSE") || (reqOp == "CACHED") ) {
                responseEntriesRead++;
              }
              else {
                eventEntriesRead++;
              }
            }
            else {
              alert("Error != 5 chunks: " + line);
              // do nothing
            }
          }
          else {
            if(currentEntry) {
              currentEntry.addRow(line + "\r\n");              
            }
            else {
              alert("Errorline: " + line);
            }
          }
        }
        else {
          // make new entry
          var initEntry = false;
        }
      }
      sstream.close();
      stream.close();
      
      // delete the file after loading it
      stream.init(file, 0x02 | 0x08 | 0x20, 0666, 0);
      stream.close();
      //alert("Entries Read: " + requestEntriesRead + ", " + responseEntriesRead + ", " + eventEntriesRead);
    }
    catch (ex) {
      alert(ex);
    }
  },
  
  getLogs: function(startFromRequestID)
  {
    //alert("getheaders:" + startFromRequestID);
    var data = "";
    var eventObjectArr = elf.oHeaderInfo.events;
    for (i in eventObjectArr) {
      eventObject = eventObjectArr[i];
      if(eventObject.ID > startFromRequestID) {
        data += eventObject.getString();
      }
    }
    return data;
  },
  getOldLogsStartingAt: function(startFromWindowID, startFromRequestID)
  {
    var data = "";
    var eventObjectArr = elf.oHeaderInfo.oldevents;
    for (i in eventObjectArr) {
      eventObject = eventObjectArr[i];
      if((eventObject.windowID == startFromWindowID) &&
         (eventObject.ID > startFromRequestID)) {
        data += eventObject.getString();
      }
    }
    return data;
  },
  getOldLogs: function()
  {
    var data = "";
    var eventObjectArr = elf.oHeaderInfo.oldevents;
    for (i in eventObjectArr) {
      eventObject = eventObjectArr[i];
      data += eventObject.getString();
    }
    return data;
  },
  flushOldLogs: function(windowID)
  {
    var data = "";
    var eventObjectArr = elf.oHeaderInfo.oldevents;
    for (i in eventObjectArr) {     
      eventObject = eventObjectArr[i];
      if(eventObject.windowID == windowID) {
        delete eventObjectArr[i];
      }
    }
    return data;
  },
  
  saveAll: function(title)
  {
    elf.saveAs(this.getOldLogs() + this.getLogs(-1),title);
  },
  
  
 /****************************************************************************
 * Event observer
 ****************************************************************************/
  // This is the observerService's observe listener.
  observe: function(aSubject, aTopic, aData) {
    if (aTopic == 'http-on-modify-request') {
      aSubject.QueryInterface(Components.interfaces.nsIHttpChannel);
      this.onModifyRequest(aSubject);
    } else if (aTopic == 'http-on-examine-response') {
      aSubject.QueryInterface(Components.interfaces.nsIHttpChannel);
      this.onExamineResponse(aSubject);
    } else if (aTopic == 'http-on-examine-cached-response') {
      aSubject.QueryInterface(Components.interfaces.nsIHttpChannel);
      this.onExamineCachedResponse(aSubject);
    } else if (aTopic == 'network:offline-status-changed') {
      this.networkStatus(aData);
    } else if ((aTopic == 'idle') || (aTopic == 'back')) {
      this.idleStatus(aTopic, aData);
    } else if(aTopic == 'prefetch-load-requested') {
      aSubject.QueryInterface(Components.interfaces.nsIDOMLoadStatus);
      //alert("prefetch-load-requested: " + aSubject.uri);
    } else if(aTopic == 'prefetch-load-completed') {
      aSubject.QueryInterface(Components.interfaces.nsIDOMLoadStatus);
      //alert("prefetch-load-completed: " + aSubject.uri);// + " " + aSubject.totalSize);
    }/*else if (aTopic == 'sleep_notification') {
      this.sleepStatus(aTopic);
    } else if (aTopic == 'wake_notification') {
      this.sleepStatus(aTopic);
    }*/
  },
  // Add a new elf's observer
  addObserver: function(obj) {
    this.observers.push(obj);
  },
  // Remove a elf's observer
  removeObserver: function(obj) {
    for (observer in this.observers) {
      if (this.observers[observer] == obj) {
        delete this.observers[observer];
      }
    }
  },
  
  
 /****************************************************************************
 * Request/Response handlers
 ****************************************************************************/
  onModifyRequest : function (oHttp)
  {
    var name = oHttp.URI.asciiSpec;
    
    // ignore server communication request/responses
    if(name.indexOf(this.LOGSERVER + "/lastrequestid?WINDOWID=") === 0) //startswith
    {
      // do nothing
      return;
    }
    if(name.indexOf(this.LOGSERVER + "/log?WINDOWID=") === 0) //startswith
    {
      // do nothing
      return;
    }
    
    // Get the response headers
    var visitor = new elf.HeaderInfoVisitor(oHttp);
    var headers = visitor.visitRequest();
    
    // Create the EventObject
    var currTime = new Date;
    var currObjectID = this.nextObjectID++;
    this.events[currObjectID] = new elf.EventObject(getUnixTime(currTime), this.windowID, currObjectID, name, "REQUEST");
    var reqObj = this.events[currObjectID];
    //var tempString = getUnixTime(reqObj.reqTime).toString() + " " + reqObj.ID.toString() + " " + reqObj.URL + " " + "REQUEST" + "\r\n";
    // add the headers
    reqObj.addHeaders(headers);
    //alert("Adding: " + reqObj.getString());
  },

  onExamineResponse : function (oHttp)
  {
    var name = oHttp.URI.asciiSpec;
    //var origname = oHttp.originalURI.asciiSpec;
    
    // ignore server communication request/responses
    if(name.indexOf(this.LOGSERVER + "/lastrequestid?WINDOWID=") === 0) //startswith
    {
      // do nothing
      return;
    }
    if(name.indexOf(this.LOGSERVER + "/log?WINDOWID=") === 0) //startswith
    {
      // do nothing
      return;
    }
    
    // modify the expiration time of the response
    var currDate = new Date;
    var currTime = getUnixTime(currDate);  
    var newExpirationTime = currTime + 1800; // 30 minutes expiration time extension // 31536000; 1 hour extension
    var expirationDate = new Date(newExpirationTime * 1000);
    oHttp.setResponseHeader("Expires", expirationDate.toString(), false);
    oHttp.setResponseHeader("Cache-Control", "max-age=31536000", false);
    
    // Get the response headers
    var visitor = new elf.HeaderInfoVisitor(oHttp);
    var headers = visitor.visitResponse();
    
    // Get the EventObject
    var currTime = new Date;
    var currObjectID = this.nextObjectID++;
    this.events[currObjectID] = new elf.EventObject(getUnixTime(currTime), this.windowID, currObjectID, name, "RESPONSE");
    var reqObj = this.events[currObjectID];
    //var tempString = getUnixTime(reqObj.reqTime).toString() + " " + reqObj.ID.toString() + " " + reqObj.URL + " " + "REQUEST" + "\r\n";
    // add the headers
    reqObj.addHeaders(headers);
    //alert("Adding: " + reqObj.getString());
    
    /*
    // 301 and 302's
    movedLocation = reqObj.getHeaderValue("Location");
    if(movedLocation) {
      // define a mapping
      this.addMovedLocation(name, movedLocation);
    }*/
  },

  onExamineCachedResponse : function (oHttp)
  {
    var name = oHttp.URI.asciiSpec;
    //var origname = oHttp.originalURI.asciiSpec;
    
    // ignore server communication request/responses
    if(name.indexOf(this.LOGSERVER + "/lastrequestid?WINDOWID=") === 0) //startswith
    {
      // do nothing
      return;
    }
    if(name.indexOf(this.LOGSERVER + "/log?WINDOWID=") === 0) //startswith
    {
      // do nothing
      return;
    }
    
    // Get the response headers
    var visitor = new elf.HeaderInfoVisitor(oHttp);
    var headers = visitor.visitResponse();
    
    // Get the EventObject
    var currTime = new Date;
    var currObjectID = this.nextObjectID++;
    this.events[currObjectID] = new elf.EventObject(getUnixTime(currTime), this.windowID, currObjectID, name, "CACHED");
    var reqObj = this.events[currObjectID];
    //var tempString = getUnixTime(reqObj.reqTime).toString() + " " + reqObj.ID.toString() + " " + reqObj.URL + " " + "REQUEST" + "\r\n";
    // add the headers
    reqObj.addHeaders(headers);
    //alert("Adding: " + reqObj.getString());
  },
  
  addMovedLocation: function(originalURL, movedLocation) {
    this.movedLocationMap[originalURL] =  movedLocation;
    //alert("Adding mapping: " + originalURL + " -> " +  movedLocation);
  },
  
  getMovedLocation: function(originalURL) {
    if (originalURL in this.movedLocationMap) {
      alert("Moved: " + originalURL + " -> " +  this.movedLocationMap[originalURL]);
      return this.movedLocationMap[originalURL];
    }
    return originalURL;
  },
  
 /****************************************************************************
 * Event listeners
 ****************************************************************************/
  networkStatus: function(data) {
    if (data == "online") {
      var currTime = new Date;
      this.events[this.nextObjectID] = new elf.EventObject(getUnixTime(currTime), this.windowID, this.nextObjectID, "-", "ONLINE");
      this.nextObjectID++;
    }
    else if (data == "offline") {
      var currTime = new Date;
      this.events[this.nextObjectID] = new elf.EventObject(getUnixTime(currTime), this.windowID, this.nextObjectID, "-", "OFFLINE");
      this.nextObjectID++;
    }
  },
  
  idleStatus: function(aTopic, data) {
    if (aTopic == "idle") {
      var currTime = new Date;
      this.events[this.nextObjectID] = new elf.EventObject(getUnixTime(currTime), this.windowID, this.nextObjectID, "-", "IDLE");
      this.nextObjectID++;
    }
    else if (aTopic == "back") {
      var currTime = new Date;
      this.events[this.nextObjectID] = new elf.EventObject(getUnixTime(currTime), this.windowID, this.nextObjectID, "-", "BACK");
      this.nextObjectID++;
    }
  },
  
  /*
  sleepStatus: function(aTopic) {
    if (aTopic == "sleep_notification") {
      var currTime = new Date;
      this.events[this.nextObjectID] = new elf.EventObject(getUnixTime(currTime), this.windowID, this.nextObjectID, "-", "SLEEP");
      this.nextObjectID++;
      //this.setIntPref(this.lpref, "nextObjectID", this.nextObjectID);
    }
    else if (aTopic == "wake_notification") {
      var currTime = new Date;
      this.events[this.nextObjectID] = new elf.EventObject(getUnixTime(currTime), this.windowID, this.nextObjectID, "-", "WAKE");
      this.nextObjectID++;
      //this.setIntPref(this.lpref, "nextObjectID", this.nextObjectID);
    }
  }
  */
  
  
 /****************************************************************************
 * Helper functions
 ****************************************************************************/
  // Preferences function for elf
  getIntPref : function(branch, name, value) {
    if (branch.prefHasUserValue(name)) {
      return branch.getIntPref(name);
    } else {
      this.setIntPref(branch, name, value);
      return value;
    }
  },
  setIntPref : function(branch, name, value) {
    branch.setIntPref(name, value);
  }
}


/****************************************************************************
 * Prefetching routines
 ****************************************************************************/
var PrefetchService = Components.classes["@mozilla.org/prefetch-service;1"].getService(Components.interfaces.nsIPrefetchService);
var prefetchLinkQueue = new Array();

function PrefetchObject(url, referer, tag, depth, priority) {
  this.timestamp = new Date;
  this.URL = url;
  this.refererURL = referer;
  this.anchorTag = tag;
  this.depth = depth;
  this.priority = priority;
}

function sortByDepth(a, b) {
    var x = a.depth;
    var y = b.depth;
    return ((x < y) ? -1 : ((x > y) ? 1 : 0));
}
/*
function sortByURL(a, b) {
    var x = a.URL.toLowerCase();
    var y = b.URL.toLowerCase();
    return ((x < y) ? -1 : ((x > y) ? 1 : 0));
}

function sortByDepthValue(A){//using objects
  initialize() //resets A to whatever is above
  for (i in A) B.push({v:i,c:A[i]})
  B.sort(function(x,y){return x.c-y.c})
  return B;
}*/

function ff_makeURI(b){
    return Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService).newURI(b,null,null)
}

// add a prefetch link to the queue
function queuePrefetchLink(url, referer, tag, depth) {
  prefetchLinkQueue[prefetchLinkQueue.length++] = new PrefetchObject(url, referer, tag, depth, 0);
/* JJJ: THIS IS BROKEN
  var tempObj = prefetchLinkQueue[url];
  if(tempObj) {
    if(tempObj.depth > depth) { // update with the lower depth and newer timestamp
      prefetchLinkQueue[url] = new PrefetchObject(url, referer, tag, depth, 0);
    }
  }*/
}

function requeuePrefetchLinks() {
  // phase 1: no link requeue
  if (elf.oHeaderInfo.experimentPhase == 1) {
    return;
  }
  
  queuedPrefetchEnum = PrefetchService.enumerateQueue(true, false);
  numQueuedPrefetch = 0;
  while (queuedPrefetchEnum.hasMoreElements() ) {
    queuedPrefetchEnum.getNext();
    numQueuedPrefetch++;
  }
  // something is already in the queue don't bother re-queueing
  // if that's the case it means the queue was never flushed
  // BFS will only run upon a START/STOP pair of events that causes a queue flush then..
  // might want to change this later when requeue is called on a timer
  if (numQueuedPrefetch != 0) {
    return;
  }
  
  prefetchLinkQueue.sort(sortByDepth);
  var allPrefetchedLinks = "";
  for (i in prefetchLinkQueue) {
    baseURL = prefetchLinkQueue[i].URL;
    refererURL = prefetchLinkQueue[i].refererURL;
    tag = prefetchLinkQueue[i].anchorTag;
    depth = prefetchLinkQueue[i].depth;
    if (getCachedSize(baseURL) > -1) { // check if the file is already in cache
      // JJJ: at this point we want to do BFS for completed downloads if we're doing BFS
      // phase 2: BFS
      if (elf.oHeaderInfo.experimentPhase == 2) {
      //if(true) { // always do bfs for now (JJJ: prefetch depth > 0 entry point, XXX: UNTESTED)
        //alert("phase 2: regular prefetching");
        if (depth < 2) { // check depth
          // open the file
          var htmlstring = readCachedFile(baseURL);
          if(htmlstring.length > 0) {
            // extract the links and embedded objects  var DOMPars = HTMLParser(htmlstring);
            var DOMPars = HTMLParser(htmlstring);
            //var links = new Array();
            
            /* JJJ: DEPRICATED - get all anchor links
            var anchorTags = DOMPars.getElementsByTagName("a"), anchorTag;
            try {
              for (j in anchorTags) {
                anchorTag = anchorTags[j];
                if (!anchorTag) {
                  continue;
                }
                
                if((anchorTag = anchorTag.getAttribute("href")) && anchorTag.length > 4) {
                  anchorTag = anchorTag.toLowerCase();
                  if( !(anchorTag.indexOf("?") >= 0 || anchorTag == baseURL)){
                    if( !(anchorTag.indexOf("logout") >= 0 || anchorTag.indexOf("logoff") >=0 )){
                      if(anchorTag.indexOf("mailto:") > -1) {
                       continue;
                      }
                      
                      anchorTag = ff_GetAbsoluteUrl(anchorTag, baseURL);
                      
                      queuePrefetchLink(anchorTag, baseURL, anchorTags[j], depth+1);
                      //alert("queueing for prefetch: " + anchorTag ); //+ "(" + anchorLinks[s].getAttribute("href") + " + " + basePage.location.href + ")");
                      PrefetchService.prefetchURI(ff_makeURI(anchorTag),
                                                  ff_makeURI(baseURL), 
                                                  anchorTags[j], true);
                      
                      // queue download of anchor target
                      // inherit depth+1, update priority based on some function
                      allPrefetchedLinks += "Prefetch-Link: " + anchorTag + ", " + baseURL + ", " + (depth+1) + "\r\n";
                    }
                  }
                }
              }
            }
            catch(ex) {
              // do nothing
              // there's various reasons why the prefetchURI call will fail, ie. the request is already prefetched or queued...
              // also, the DOMparser spews a bunch of crap, just ignore it
              //alert(anchorTag +" exception at: \n" + ex)
            }
*/
            // get all embedded objects including anchor links to further pages
            // they are all assigned depth + 1
            for (element in elementAttributes) {
              //var element = et;
              for (a in elementAttributes[element]) {
                var attribute = elementAttributes[element][a];
          
                anchorTags = DOMPars.getElementsByTagName(element);
                
                //alert("Element: " + element + "\r\n" + "Attribute: " + attribute);
                
                /*
                somestring = "anchorTags found:\r\n";
                for (s in anchorTags) {
                  somestring += anchorTags[s] + "\n";
                }
                alert(baseURL + ":\r\n" + somestring);
                */
                try {
                  for (j in anchorTags) {
                    anchorTag = anchorTags[j];
                    if (!anchorTag) {
                      continue;
                    }
                    
                    if((anchorTag = anchorTag.getAttribute(attribute)) && anchorTag.length > 4) {
                      
                      anchorTag = anchorTag.toLowerCase();
                      if( !(anchorTag.indexOf("?") >= 0 || anchorTag == baseURL)){
                        if( !(anchorTag.indexOf("logout") >= 0 || anchorTag.indexOf("logoff") >=0 )){
                          if(anchorTag.indexOf("mailto:") > -1) {
                            continue;
                          }
                          
                          anchorTag = ff_GetAbsoluteUrl(anchorTag, baseURL);
                          //alert("Element: " + element + "\r\n" + "Attribute: " + attribute + "\r\n" + anchorTag);
                          queuePrefetchLink(anchorTag, baseURL, anchorTags[j], depth+1);
                          //alert("queueing for prefetch: " + anchorTag ); //+ "(" + anchorLinks[s].getAttribute("href") + " + " + basePage.location.href + ")");
                          PrefetchService.prefetchURI(ff_makeURI(anchorTag),
                                                      ff_makeURI(baseURL), 
                                                      anchorTags[j], true);
                          
                          // queue download of anchor target
                          // inherit depth+1, update priority based on some function
                          allPrefetchedLinks += "Prefetch-Link: " + anchorTag + ", " + baseURL + ", " + (depth+1) + "\r\n";
                        }
                      }
                    }
                  }
                }
                catch(ex) {
                  // parser spews a bunch of crap, just ignore it
                  //alert(anchorTag +" exception at: \n" + ex)
                }

              }
            }

          }
        }
      }
      else if (elf.oHeaderInfo.experimentPhase == 3) {
        // phase 3: fancy prefetching implementation goes here
        if (depth < 2) { // check depth
          // open the file
          var htmlstring = readCachedFile(baseURL);
          if(htmlstring.length > 0) {
            // extract the links and embedded objects  var DOMPars = HTMLParser(htmlstring);
            var DOMPars = HTMLParser(htmlstring);
            //var links = new Array();
            
            // get all embedded objects including anchor links to further pages
            // they are all assigned depth + 1
            for (element in elementAttributes) {
              //var element = et;
              for (a in elementAttributes[element]) {
                var attribute = elementAttributes[element][a];
          
                anchorTags = DOMPars.getElementsByTagName(element);
                
                //alert("Element: " + element + "\r\n" + "Attribute: " + attribute);
                
                /*
                somestring = "anchorTags found:\r\n";
                for (s in anchorTags) {
                  somestring += anchorTags[s] + "\n";
                }
                alert(baseURL + ":\r\n" + somestring);
                */
                try {
                  for (j in anchorTags) {
                    anchorTag = anchorTags[j];
                    if (!anchorTag) {
                      continue;
                    }
                    
                    if((anchorTag = anchorTag.getAttribute(attribute)) && anchorTag.length > 4) {
                      
                      anchorTag = anchorTag.toLowerCase();
                      if( !(anchorTag.indexOf("?") >= 0 || anchorTag == baseURL)){
                        if( !(anchorTag.indexOf("logout") >= 0 || anchorTag.indexOf("logoff") >=0 )){
                          if(anchorTag.indexOf("mailto:") > -1) {
                            continue;
                          }
                          
                          anchorTag = ff_GetAbsoluteUrl(anchorTag, baseURL);
                          //alert("Element: " + element + "\r\n" + "Attribute: " + attribute + "\r\n" + anchorTag);
                          queuePrefetchLink(anchorTag, baseURL, anchorTags[j], depth+1);
                          //alert("queueing for prefetch: " + anchorTag ); //+ "(" + anchorLinks[s].getAttribute("href") + " + " + basePage.location.href + ")");
                          PrefetchService.prefetchURI(ff_makeURI(anchorTag),
                                                      ff_makeURI(baseURL), 
                                                      anchorTags[j], true);
                          
                          // queue download of anchor target
                          // inherit depth+1, update priority based on some function
                          allPrefetchedLinks += "Prefetch-Link: " + anchorTag + ", " + baseURL + ", " + (depth+1) + "\r\n";
                        }
                      }
                    }
                  }
                }
                catch(ex) {
                  // parser spews a bunch of crap, just ignore it
                  //alert(anchorTag +" exception at: \n" + ex)
                }

              }
            }

          }
        }
      }
      else {
        //alert("phase " + elf.oHeaderInfo.experimentPhase);
      }
      delete prefetchLinkQueue[i];
    }
    else {
      try {
        PrefetchService.prefetchURI(ff_makeURI(baseURL),
                                    ff_makeURI(refererURL), 
                                    tag, true); // JJJ: true means allow query string links (i think) //, true, false); JJJ: not sure we need this not in the .cpp of the PrefetchService
        //allPrefetchedLinks += "Re-queued: " + baseURL + "\r\n";
      }
      catch(ex) {
        // do nothing
        // there's various reasons why the prefetchURI call will fail, ie. the request is already prefetched or queued...
      }
    }
  }
        
  if (allPrefetchedLinks.length > 0) {
    //alert(allPrefetchedLinks);
    var currTime = new Date;
    var currObjectID = elf.oHeaderInfo.nextObjectID++;
    elf.oHeaderInfo.events[currObjectID] = new elf.EventObject(getUnixTime(currTime), elf.oHeaderInfo.windowID, currObjectID, baseURL, "PREFETCH_REQUEUE");
    var reqObj = elf.oHeaderInfo.events[currObjectID];
    reqObj.addRow(allPrefetchedLinks);
  }
}

function readCachedFile(url) {
  var cacheService = Components.classes["@mozilla.org/network/cache-service;1"].getService(Components.interfaces.nsICacheService);
  
  var data = "";
  try {
    var cacheSession = cacheService.createSession('HTTP', 0, true);
    var cacheEntryDescriptor = cacheSession.openCacheEntry(url, Components.interfaces.nsICache.ACCESS_READ, false);
    var parseable = false;
    if(cacheEntryDescriptor) {
      if(cacheEntryDescriptor.dataSize) {
        // check parseable
        headers = cacheEntryDescriptor.getMetaDataElement("response-head");
        if(headers) {
          headerchunks = headers.split("\r\n");
          //alert(headerchunks.length.toString() + " -\n" + headers);
          for(s in headerchunks) {
            if(headerchunks[s].indexOf("Content-Type") > -1 &&
              headerchunks[s].indexOf("html") > -1){ // only html are parseable for now, should cover aspx too?
              parseable = true;
            }
          }
        }
        
        if (parseable) {
          var stream = cacheEntryDescriptor.openInputStream(0);
          
          // create file output stream and use read mode
          // 0x02 writing, 0x08 create file, 0x20 truncate length if exist
          //var stream = Components.classes["@mozilla.org/network/file-input-stream;1"].createInstance(Components.interfaces.nsIFileInputStream);
          //stream.init(cacheEntryDescriptor.file, 0x01, 0444, null);
          
          var sstream = Components.classes["@mozilla.org/scriptableinputstream;1"].createInstance(Components.interfaces.nsIScriptableInputStream);
          sstream.init(stream);
          
          var data = sstream.read(sstream.available());
          
          //sstream.close();
          stream.close();
        }
        else {
          // for debugging really
          //alert("not parseable: " + url);
        }
      }
    }
    
    cacheEntryDescriptor.close();
  } catch (ex) {
    // do nothing
    alert("error: " + url + "\r\n" + ex.toString());
  }
  
  return data;
}

function isParseable(contentType) {
  if (contentType.indexOf("htm") > -1 ||
      contentType.indexOf("asp") > -1) {
    return true;
  }
  return false;
}
/*
// helper function that checks if a URL is parseable
function isParseable(url) {
  var fileExtensionStartPos = anchorTag.length - 4;
  if(anchorTag.indexOf(".htm") == fileExtensionStartPos ||
     anchorTag.indexOf(".html") == fileExtensionStartPos-1 ||
     anchorTag.indexOf(".asp") == fileExtensionStartPos-1 ||
     anchorTag.indexOf(".aspx") == fileExtensionStartPos-1 ||
     anchorTag.indexOf(".xhtml") == fileExtensionStartPos-1) {
     //anchorTag.indexOf(".jpg") == fileExtensionStartPos ||
     //anchorTag.indexOf(".gif") == fileExtensionStartPos ||
     //anchorTag.indexOf(".png") == fileExtensionStartPos ||
     //anchorTag.indexOf(".jpeg") == fileExtensionStartPos-1 ||
     //anchorTag.indexOf(".txt") == fileExtensionStartPos ||
     //anchorTag.indexOf(".text") == fileExtensionStartPos-1 ||
     //anchorTag.indexOf(".xml") == fileExtensionStartPos ||
     //anchorTag.indexOf(".pdf") == fileExtensionStartPos) {
    return true;
  }
  return false;
}
*/

// helper that parses a html string into a DOM
function HTMLParser(aHTMLString){
  var html = document.implementation.createDocument("http://www.w3.org/1999/xhtml", "html", null),
    body = document.createElementNS("http://www.w3.org/1999/xhtml", "body");
  html.documentElement.appendChild(body);

  body.appendChild(Components.classes["@mozilla.org/feed-unescapehtml;1"]
    .getService(Components.interfaces.nsIScriptableUnescapeHTML)
    .parseFragment(aHTMLString, false, null, body));

  return body;
}

// embedded elements organized by HTML version
var elementAttributes = new Array();
// 2.0
elementAttributes["a"] = ["href"];
elementAttributes["base"] = ["href"];
elementAttributes["img"] = ["src"];
elementAttributes["link"] = ["href"];
// 3.2
elementAttributes["applet"] = ["code", "codebase", "archive", "object"];
//elementAttributes["applet"] = "codebase";
elementAttributes["body"] = ["background"];
elementAttributes["input"] = ["src"];
// 4.01
//elementAttributes["applet"] = "archive";
//elementAttributes["applet"] = "object";
elementAttributes["frame"] = ["src"];
elementAttributes["head"] = ["profile"];
elementAttributes["iframe"] = ["src"];
elementAttributes["object"] = ["archive", "data"];
//elementAttributes["object"] = "data";
elementAttributes["script"] = ["src"];
// 5.0
elementAttributes["audio"] = ["src"];
elementAttributes["command"] = ["icon"];
elementAttributes["embed"] = ["src"];
elementAttributes["event-source"] = ["src"];
elementAttributes["source"] = ["src"];
elementAttributes["video"] = ["src", "poster"];
//elementAttributes["video"] = "poster";


function doPrefetch(t, s){
    // phase 1: no prefetching
    if (elf.oHeaderInfo.experimentPhase == 1) {
      return;
    }
    
    var basePage = t.originalTarget;
    if(basePage.location.href.indexOf("http://") == 0){
      //var whitelist = PreferencesService.getCharPref("extensions.fasterfox.whitelist").split(","),o=p.length;
      var anchorTags = basePage.getElementsByTagName("a"), anchorTag;//,m;
      var numAnchorTags = anchorTags.length > 100 ? 100 : anchorTags.length;
      if(s == null || s <= 0){
        s=0;
      }
      //s=s;
      var allPrefetchedLinks = "";
      t:for( ; s < numAnchorTags; s++){
        if((anchorTag = anchorTags[s].getAttribute("href").toLowerCase()) && anchorTag.length > 4){
          if( !(anchorTag.indexOf("?") >= 0 || anchorTag == basePage.location.href)){
            if( !(anchorTag.indexOf("logout") >= 0 || anchorTag.indexOf("logoff") >=0 )){
              if(anchorTag.indexOf("mailto:") > -1) {
               continue t;
              }
              /*
              var fileExtensionStartPos = anchorTag.length - 4;
              if(anchorTag.indexOf(".htm") == fileExtensionStartPos ||
                 anchorTag.indexOf(".html") == fileExtensionStartPos-1 ||
                 anchorTag.indexOf(".jpg") == fileExtensionStartPos ||
                 anchorTag.indexOf(".gif") == fileExtensionStartPos ||
                 anchorTag.indexOf(".png") == fileExtensionStartPos ||
                 anchorTag.indexOf(".jpeg") == fileExtensionStartPos-1 ||
                 anchorTag.indexOf(".txt") == fileExtensionStartPos ||
                 anchorTag.indexOf(".text") == fileExtensionStartPos-1 ||
                 anchorTag.indexOf(".xml") == fileExtensionStartPos ||
                 anchorTag.indexOf(".pdf") == fileExtensionStartPos) {
              */
                  anchorTag = ff_GetAbsoluteUrl(anchorTag, basePage.location.href);
                  /* // whitelisting
                  for(m = 0; m < o; m++){
                      if(whitelist[m].length>0&&anchorTag.indexOf(whitelist[m])>=0){
                          continue t;
                      }
                  }*/
                  /* // opt out "robots.txt"
                  anchorTag = ff_IsSiteOptOut(anchorTag,t,s);
                  if(!anchorTag){
                      if(anchorTag == -1){
                        return
                      }*/
                      try{
                        var absoluteURL = ff_GetAbsoluteUrl(anchorTags[s].getAttribute("href"), basePage.location.href);
                        if (absoluteURL) {
                          if(absoluteURL.indexOf("https://") === 0) //startswith
                          {
                            // do nothing
                            //return;
                          }
                          else{
                            // always add it to the queue so even if the page is cached we can do further crawling
                            // log it too, just don't bother actually fetching it since its already cached
                            queuePrefetchLink(absoluteURL, basePage.location.href, anchorTags[s], 0);
                            allPrefetchedLinks += "Prefetch-Link: " + absoluteURL + ", " + basePage.location.href + ", 0" + "\r\n";
                            if(getCachedSize(absoluteURL) < 0) { // prefetch regardless of whether it already exists
                              //alert("queueing for prefetch: " + absoluteURL ); //+ "(" + anchorTags[s].getAttribute("href") + " + " + basePage.location.href + ")");
                              PrefetchService.prefetchURI(ff_makeURI(absoluteURL),
                                                          ff_makeURI(basePage.location.href), 
                                                          anchorTags[s], true); // JJJ: true means allow query string links (i think) //, true, false); JJJ: not sure we need this not in the .cpp of the PrefetchService
                              // should log that we're prefetching this URL... the successful requests appear in the log.. idk
                              
                              //allPrefetchedLinks += "Prefetch-Link: " + absoluteURL + "\r\n";
                            }
                          }
                        }
                      }catch(k)
                      {
                        // there's various reasons why the prefetchURI call will fail, ie. the request is already prefetched or queued...
                        // do nothing
                      }
                  //}
              //}
            }
          }
        }
      }
      
      /*
      queuedPrefetchEnum = PrefetchService.enumerateQueue(true, false);
      numQueuedPrefetch = 0;
      while (queuedPrefetchEnum.hasMoreElements() ) {
        queuedPrefetchEnum.getNext();
        numQueuedPrefetch++;
      }
      alert("queue length: " + numQueuedPrefetch);
      */
      
      if (allPrefetchedLinks.length > 0) {
        //alert("Prefetching: \r\n" + allPrefetchedLinks);
        var currTime = new Date;
        var currObjectID = elf.oHeaderInfo.nextObjectID++;
        elf.oHeaderInfo.events[currObjectID] = new elf.EventObject(getUnixTime(currTime), elf.oHeaderInfo.windowID, currObjectID, basePage.location.href, "PREFETCH");
        var reqObj = elf.oHeaderInfo.events[currObjectID];
        reqObj.addRow(allPrefetchedLinks);
      }
    }
  //}
}

function ff_GetAbsoluteUrl(url, baseurl) {
    if(url && url.indexOf("://") > 0 ){
        return url;
    }

    baseurl = baseurl ? baseurl.substring(0, baseurl.lastIndexOf("/")+1):dynapi.documentPath;
    url = url.replace(/^(.\/)*/,"");
    baseurl = baseurl.replace(/(\?.*)$/,"").replace(/(#.*)*$/,"").replace(/[^\/]*$/, "");
    if(url.indexOf("/") == 0){
        return baseurl.substring(0, baseurl.indexOf("/", baseurl.indexOf("//") + 2)) + url;
    }
    else{
        for( ; url.indexOf("../") == 0; ){
            url = url.replace(/^..\//,"");
            baseurl = baseurl.replace(/([^\/]+[\/][^\/]*)$/,"");
        }
    }
    return baseurl + url;
}

/*
function ff_GetBaseURL(d){
    var c=d.indexOf("://")+3;
    c=d.indexOf("/",c);
    if(c<0){c=d.length}
    return d.substring(0,c)
}*/

/*
function ff_IsSiteOptOut(g,c,j){
    var i=ff_GetBaseURL(g)+"/robots.txt";
    for(g=0;g<robotsCacheMax;g++){
        if(i==robotsCache[g]){
            return optOut[g]
        }
    }
    var h=new XMLHttpRequest;h.open("GET",i,true);
    h.onreadystatechange=function(){
        if(h.readyState==4){
            if(h.status==200){
                var a=h.responseText.toLowerCase().indexOf("fasterfox")>=0;
                robotsCacheTop=(robotsCacheTop+1)%robotsCacheMax;
                robotsCache[robotsCacheTop]=i;
                optOut[robotsCacheTop]=a
            }
        }
    };
    h.send(null);
    return -1
}*/


/****************************************************************************
 * Cache size setting and getting methods
 ****************************************************************************/
function set_cache_settings() {
  var pref_service = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
  branch = pref_service.getBranch( 'browser.cache.' );
  // enable the disk cache
  branch.setBoolPref( 'disk.enable', true);
  var disk_value = 500000; // some default disk cache size
  branch.setIntPref( 'disk.capacity', disk_value );
  var default_check_doc_freq = 2;
  branch.setIntPref( 'check_doc_frequency', default_check_doc_freq );
  /*
  var ram_value = document.getElementById('max_ram_cache').value;
  if ( ram_value > 0 ) {
      prefs.setIntPref( 'memory.capacity', ram_value );
  }*/
}

function cs_updated_stat( type, aDeviceInfo ) {
  var current = round_memory_usage( aDeviceInfo.totalSize );
  var max = round_memory_usage( aDeviceInfo.maximumSize );
  //var current = round_memory_usage( aDeviceInfo.totalSize/1024/1024 );
  //var max = round_memory_usage( aDeviceInfo.maximumSize/1024/1024 );
  
  if ( type =='memory' ) {
    // JJJ: not logging memory for now
    // log this
    /*
    objectID = elf.oHeaderInfo.nextObjectID;
    elf.oHeaderInfo.nextObjectID++;
    var currTime = new Date;
    elf.oHeaderInfo.events[objectID] =
      new elf.EventObject(getUnixTime(currTime), elf.oHeaderInfo.windowID, objectID, url, "STOP_LOAD_PAGE");
    */
  }
  else if ( type == 'disk' ) {
    // log this
    objectID = elf.oHeaderInfo.nextObjectID;
    elf.oHeaderInfo.nextObjectID++;
    var currTime = new Date;
    elf.oHeaderInfo.events[objectID] =
      new elf.EventObject(getUnixTime(currTime), elf.oHeaderInfo.windowID, objectID, current.toString(), "CACHE_SIZE");
  }
/*
  // Now, update the status bar label...
  var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
      .getService(Components.interfaces.nsIWindowMediator);
  var win = wm.getMostRecentWindow("navigator:browser");
  if (win) {
      win.document.getElementById(cs_id).setAttribute('value', current + " MB / " + max + " MB " );
  }*/
}

function round_memory_usage( memory ) {
    memory = eval( memory );
    memory *= 10;
    memory = Math.round(memory)/10;
    return memory;
}

/****************************************************************************
 * Request/Response header parsers
 ****************************************************************************/
function update_cache_status() {
    var cache_service = Components.classes["@mozilla.org/network/cache-service;1"].getService(Components.interfaces.nsICacheService);

    var cache_visitor = {
        visitEntry: function(a,b) {},
        visitDevice: function( device, aDeviceInfo ) {
            cs_updated_stat( device, aDeviceInfo );
        }
    }

    cache_service.visitEntries( cache_visitor );
}

function updateTimer(myObject){
  var b;
  if(Finished){
      //b=StopTime.getTime()-StartTime.getTime();
      //document.getElementById("fasterfox-label").value=ff_TimeStr(b,true)
  }
  else{
    // get the per-timer statistics
    // cache usage
    update_cache_status();
    
    var client = new XMLHttpRequest();
    var objectPointer = elf.oHeaderInfo;
    
    client.onreadystatechange = function()
    { 
      if(client.readyState == 4)
      {
        if(client.status == 200) {
          //alert(client.responseText);
          var chunks = client.responseText.split(" ");
          if (chunks.length != 3) {
            alert("Error: Incompatible server version, returned: " + client.responseText);
            return;
          }
          // JJJ: for some reason we need to abort after Firefox 3.6.3
          client.abort();
          
          machineID = parseInt(chunks[0]);
          if(machineID != objectPointer.machineID) {
            objectPointer.machineID = machineID;
            objectPointer.setIntPref(objectPointer.lpref, "machineID", objectPointer.machineID);
          }
          //alert("savedmachineID: " + objectPointer.machineID + " newmachineID: " + machineID);

          objectPointer.lastAckedObjectID = parseInt(chunks[1]);
          objectPointer.setIntPref(objectPointer.lpref, "lastAckedObjectID", objectPointer.lastAckedObjectID);          
          
          // what do we do after we get a new experiment phase? there needs to be some way of transitioning smoothly...
          // phase 1: turn off prefetching and highlighting
          // phase 2: turn on prefetching and highlighting
          // phase 3: flush the queue, turn on prefetching, highlighting, and change prefetching algorithm
          var currTime = new Date;
          newPhase = parseInt(chunks[2]);
          if(objectPointer.experimentPhase != newPhase) {
            objectPointer.experimentPhase = newPhase;
            //alert("New Phase: " + objectPointer.experimentPhase);
            objectPointer.setIntPref(objectPointer.lpref, "experimentPhase", objectPointer.experimentPhase);
            
            // add new phase event to the log
            var currObjectID = elf.oHeaderInfo.nextObjectID++;
            elf.oHeaderInfo.events[currObjectID] = new elf.EventObject(getUnixTime(currTime), elf.oHeaderInfo.windowID, currObjectID, newPhase.toString(), "NEW_PHASE");
            var reqObj = elf.oHeaderInfo.events[currObjectID];
            reqObj.addRow(allPrefetchedLinks);
          }
          
          sendClient = new XMLHttpRequest();
          
          if (oldLogCount > 0) {
            // flush old request objects first
            message = objectPointer.getOldLogsStartingAt(objectPointer.oldWindowID, objectPointer.lastAckedObjectID);
            if (message.length > 0) {
              //alert(objectPointer.oldWindowID.toString() + " " + objectPointer.lastAckedObjectID.toString() + " " + message.length.toString() + "\r\n" + message);
              sendClient.open("POST", objectPointer.LOGSERVER + "/log?MACHINEID=" + objectPointer.machineID + "&WINDOWID=" + objectPointer.oldWindowID + "&VERSION=" + objectPointer.version + "&LOCALTIME=" + getUnixTime(currTime));
            }
            else {
              // caught up with this oldwindowID
              objectPointer.flushOldLogs(objectPointer.oldWindowID);
              //alert("flushed: " + objectPointer.oldWindowID);
              return;
            }
          }
          else {
            message = objectPointer.getLogs(objectPointer.lastAckedObjectID);
            sendClient.open("POST", objectPointer.LOGSERVER + "/log?MACHINEID=" + objectPointer.machineID + "&WINDOWID=" + objectPointer.windowID + "&VERSION=" + objectPointer.version + "&LOCALTIME=" + getUnixTime(currTime));
          }
          
          sendClient.setRequestHeader("Content-Type", "text/plain;charset=UTF-8");
          sendClient.setRequestHeader("Connection", "close");
          sendClient.send(message);
        }
        else  {
          // do nothing
          //alert("Couldn't connect to the server: " + client.status);
        }
      }
    };
  
    // check the status of the connection, log it
    // if up then try to send the update
    // get a connection to poll for the nextID
    // JJJ: because for some reason just getting the length property isn't working...
    var oldLogCount = 0;
    var oldObject = null;
    for (i in objectPointer.oldevents) {
      if (!oldObject) {
        oldObject = objectPointer.oldevents[i];
      }
      oldLogCount++;
    }
    if (oldLogCount > 0) {
      objectPointer.oldWindowID = oldObject.windowID;
      //alert("setting timer");
      something = objectPointer.LOGSERVER + "/lastrequestid?MACHINEID=" + objectPointer.machineID + "&WINDOWID=" + objectPointer.oldWindowID + "&VERSION=" + objectPointer.version;
      client.open("GET", something, true);
    }
    else {
      //alert("setting timer2");
      something = objectPointer.LOGSERVER + "/lastrequestid?MACHINEID=" + objectPointer.machineID + "&WINDOWID=" + objectPointer.windowID + "&VERSION=" + objectPointer.version;
      client.open("GET", something, true);
      //alert("getting lastrequestid");
    }
    client.send(null);

    // timing
    CurrentTime = new Date;
    //elapsed=CurrentTime.getTime()-StartTime.getTime();
    //document.getElementById("fasterfox-label").value=ff_TimeStr(b,false);
    
    //setTimeout("updateTimer()", 20000);
    setTimeout("updateTimer()", 300000);
  }
}

function checkIfOnline(myObject){
  prefsService = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
  ioService = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService2);
  if(Finished){
      //b=StopTime.getTime()-StartTime.getTime();
      //document.getElementById("fasterfox-label").value=ff_TimeStr(b,true)
  }
  else{
    // get the per-timer statistics
    // cache usage
    //update_cache_status();
    
    var client = new XMLHttpRequest();
    var objectPointer = elf.oHeaderInfo;
    
    client.onreadystatechange = function()
    { 
      if(client.readyState == 4)
      {
        isOffline = prefsService.getBoolPref("browser.offline");
        if(client.status == 200) {
          /*
          // set online
          if(isOffline) {
            //ioService.offline = false;
            prefsService.setBoolPref('browser.offline', false); // I don't think this preference actually does anything except indicate, the ioService one actually affects where requests go
            alert("online: " + client.client.getAllResponseHeaders());
          }
          */
        }
        else {
          // set offline
          if(!isOffline) {
            ioService.offline = true;
            prefsService.setBoolPref('browser.offline', true);
            //alert("offline.");
          }
        }
      }
    };
  
    //client.setRequestHeader("Cache-Control", "no-cache");
    client.open("HEAD", "http://www.google.com", true); 
    client.send(null);
    
    setTimeout("checkIfOnline()", 60000);
  }
}

function ff_trimString(sInString) {
  sInString = sInString.replace( /^\s+/g, "" );// strip leading
  return sInString.replace( /\s+$/g, "" );// strip trailing
}

function stopTimer(){
    StopTime=new Date;
    Finished=true;
    Started=false;
}
 
function startTimer(myObject){
  if(Started) {return;}
  StartTime=new Date;
  Finished=false;
  updateTimer(myObject);
  checkIfOnline(myObject);
  Started=true;
  
  // initialize the preference setting to avoid exception
  prefsService = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
  prefsService.setBoolPref('browser.offline', false);
}

// get the cached file size of a url, -1 if it doesn't exist
function getCachedSize(url)
{
  var fileSize = -1;
  var cacheService = Components.classes["@mozilla.org/network/cache-service;1"].getService(Components.interfaces.nsICacheService);
  try {
    var cacheSession = cacheService.createSession('HTTP',0,true);
    //var cacheSession = cacheService.createSession('HTTP-memory-only',1,true);
    var cacheEntryDescriptor = cacheSession.openCacheEntry(url, Components.interfaces.nsICache.ACCESS_READ, false);
    if(cacheEntryDescriptor) {
      fileSize = cacheEntryDescriptor.dataSize;
      //alert(url + "\nExpires: " + new Date(cacheEntryDescriptor.expirationTime * 1000));
      //alert(fileSize);
      /*&
      var expiryTime = cacheEntryDescriptor.expirationTime;
      var currDate = new Date();
      var currTime = getUnixTime(currDate);
      if (expiryTime < currTime) {
        alert(url + "\nExpires: " + new Date(expiryTime * 1000));
      }*/
      cacheEntryDescriptor.close();
    }
  } catch (ex) {
    // do nothing
  }
  return fileSize;
}

/****************************************************************************
 * Request/Response header parsers
 ****************************************************************************/
elf.HeaderInfoVisitor = function(oHttp)
{
  //dump("HeaderInfoVisitor\n");
  this.oHttp = oHttp;
  this.headers = new Array();
}
elf.HeaderInfoVisitor.prototype = 
{
  oHttp : null,
  headers : null,
  getHttpResponseVersion: function ()
  {
    var version = "1.z"; // Default value
    // Check if this is Mozilla v1.5a and more
    try {
      var maj = new Object();
      var min = new Object();
      this.oHttp.QueryInterface(Components.interfaces.nsIHttpChannelInternal);
      this.oHttp.getResponseVersion(maj,min);
      version = "" + maj.value + "."+ min.value;
    } catch (ex) {}
    return version;
  },
  getHttpRequestVersion: function (httpProxy)
  {
    var version = "1.0"; // Default value for direct HTTP and proxy HTTP
    try {
      // This code is based on netwerk/protocol/http/src/nsHttpHandler.cpp (PrefsChanged)
      var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
      pref = pref.getBranch("");
      // Now, get the value of the HTTP version fields
      if (httpProxy) {
        var tmp = pref.getCharPref("network.http.proxy.version");
        if (tmp == "1.1") version = tmp;
      } else {
        var tmp = pref.getCharPref("network.http.version");
        if (tmp == "1.1" || tmp == "0.9") version = tmp;
      }
    } catch (ex) {}
    return version;
  },
  useHttpProxy : function (uri)
  {
    // This code is based on netwerk/base/src/nsProtocolProxyService.cpp (ExamineForProxy)
    try {
      var pps = Components.classes["@mozilla.org/network/protocol-proxy-service;1"].getService().QueryInterface(Components.interfaces.nsIProtocolProxyService);
      
          // If a proxy is used for this url, we need to keep the host part
      if (typeof(pps.proxyEnabled) != "undefined") {
        // Mozilla up to 1.7
        if (pps.proxyEnabled && (pps.examineForProxy(uri)!=null)) {
          // Proxies are enabled.  Now, check if it is an HTTP proxy.
          return this.isHttpProxy();
        }
      } else {
        // Firefox and Mozilla 1.8+
        if (pps.resolve(uri, pps.RESOLVE_NON_BLOCKING)!=null) {
          // Proxies are enabled.  Now, check if it is an HTTP proxy.
          return this.isHttpProxy();
        }
      }
      return false; // No proxy or not HTTP Proxy
    } catch (ex) {
      return null; // Error
    }
  },

  isHttpProxy : function()
  {
    // Check if an HTTP proxy is configured.
    var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
    pref = pref.getBranch("");
    // Now, get the value of the HTTP proxy fields
    var http_host = pref.getCharPref("network.proxy.http");
    var http_port = pref.getIntPref("network.proxy.http_port");
    // network.proxy.http_port network.proxy.http
    if (http_host && http_port>0) {
      return true; // HTTP Proxy
    }
    return false;
  },
  visitHeader : function (name, value)
  {
    this.headers[name] = value;
  },
  visitRequest : function ()
  {
    this.headers = new Array();
    var uri, note, ver;
    try {
      
      // Get the URL and get parts
      // Should I use  this.oHttp.URI.prePath and this.oHttp.URI.path to make
      // the URL ?  I still need to remove the '#' sign if present in 'path'
      var url = String(this.oHttp.URI.asciiSpec);

      // If an http proxy is used for this url, we need to keep the host part
      if (this.useHttpProxy(this.oHttp.URI)==true) {
        uri = url.match(/^(.*?\/\/[^\/]+\/[^#]*)/)[1];
        ver = this.getHttpRequestVersion(true);
      } else {
        uri = url.match(/^.*?\/\/[^\/]+(\/[^#]*)/)[1];
        ver = this.getHttpRequestVersion(false);
      }
    } catch (ex) {
      //dump("PPS: cas5: " + ex + "\n");
      uri = String(this.oHttp.URI.asciiSpec);
      note = "Unsure about the precedent REQUEST uri";
    }
    this.headers["REQUEST"] = this.oHttp.requestMethod + " " 
                            + uri + " HTTP/" + ver;
    if (note) this.headers["NOTE"] = note;
    this.oHttp.visitRequestHeaders(this);

/*
    // There may be post data in the request
    var postData = this.getPostData(this.oHttp);
    if (postData) {
      postData.visitPostHeaders(this);
      this.visitHeader("POSTDATA",postData);
    } else {
      this.visitHeader("POSTDATA",null);
    }
*/
    return this.headers;
  },
  visitResponse : function ()
  {
    var ver = this.getHttpResponseVersion();
    this.headers = new Array();
    this.headers["RESPONSE"] = "HTTP/" + ver + " " + this.oHttp.responseStatus 
                    + " " + this.oHttp.responseStatusText;
    //this.headers["loadGroup"] = this.oHttp.loadGroup
    //this.headers["owner"] = this.oHttp.owner
    //this.headers["notificationCallbacks"] = this.oHttp.notificationCallbacks
    //if (this.oHttp.loadGroup) this.headers["loadGroup.ncb"] = this.oHttp.loadGroup.notificationCallbacks
    //this.headers["Cache-Control"] = "public,max-age=604800";
    this.oHttp.visitResponseHeaders(this);
    return this.headers;
  }
}

// Utility function to save data to a file
elf.saveAs = function(data, title)
{
  if (!title) title = "elf";
  const MODE =  0x2A; // MODE_WRONLY | MODE_CREATE | MODE_TRUNCAT
  const PERM = 00644; // PERM_IRUSR | PERM_IWUSR | PERM_IRGRP | PERM_IROTH
  const PICKER_CTRID = "@mozilla.org/filepicker;1";
  const FILEOUT_CTRID = "@mozilla.org/network/file-output-stream;1";
  const nsIFilePicker = Components.interfaces.nsIFilePicker;
  const nsIFileOutputStream = Components.interfaces.nsIFileOutputStream;

  try {
    var picker = Components.classes[PICKER_CTRID].createInstance(nsIFilePicker);
    picker.appendFilters(Components.interfaces.nsIFilePicker.filterAll);
    picker.init (window, title, Components.interfaces.nsIFilePicker.modeSave);
    var rv = picker.show();

    if (rv != Components.interfaces.nsIFilePicker.returnCancel) {
      var os = Components.classes[FILEOUT_CTRID].createInstance(nsIFileOutputStream);
      os.init(picker.file, MODE, PERM, 0);
      os.write(data, data.length);
    }
  } catch (ex) {
    alert(ex);
  }
}
/*
XULSchoolChrome.BrowserOverlay = {
  sayHello : function(aEvent) {
    let stringBundle = document.getElementById("xulschoolhello-string-bundle");
    let message = stringBundle.getString("xulschoolhello.greeting.label");

    window.alert(message);
  }
};*/
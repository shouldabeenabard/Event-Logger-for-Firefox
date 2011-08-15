//Besme Ab Wo Wold Wo Menfes Kidus
//Maisera w/God misera

if(!elf) var elf={};
if(!elf) elf={};

var Started=false,StartTime,StopTime,Finished;

elf.oHeaderInfo = null;
elf.updateServer = "<Your Log Server>";     //e.g. "http://216.165.108.94:80", "http://localhost:8080",
elf.appId = "<The App ID>";
elf.updateEvery = 300000;                        //In milliseconds, how often update the server
elf.commonCred = null;
elf.considerInactiveAfter=3*60;                 //AMR: in seconds, when is user considered not looking at page.

elf.startHeaderInfo = function() {
  
  elf.loadMpersonalCred();              //AMR: Load the acquired m personal credentials
  elf.mTabTime.init();                  //AMR: Init the tab viewership timer
  
  elf.oHeaderInfo = new elf.HeaderInfo();
  elf.oHeaderInfo.start();
  elf.addToListener(elf.oHeaderInfo);
  
  //var prefManager = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
  set_cache_settings();
  perTabListener.start();
}

elf.loadMpersonalCred=function(){
		Components.utils.import("resource://eventlogger/mpersonalCore.js");
		elf.commonCred = mPersonalCred;
        //window.alert(elf.commonCred.user_id1);
}

elf.stopHeaderInfo = function() {

  elf.mTabTime.uninit();            //AMR: Uninit mTabTimer, before the events are saved up
  
  elf.removeFromListener(elf.oHeaderInfo)
  elf.oHeaderInfo.stop();
  elf.oHeaderInfo = null;
  
  perTabListener.stop();
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
  }
}


/****************************************************************************
* AMR: mTab Viewership Timer
****************************************************************************/
elf.mTabTime = {
	
	window_title: "undefined",
	window_loc:"",
	start_trigger:"",
	record_trigger:"",
	idleTrigger: elf.considerInactiveAfter,
	timeStore: null,
	lastSelected: null,
	
	idleGurard : {isIdle:false, idleSince:""},
	userIsIdle: function(){
		return this.idleGuard.isIdle;
	},
		
	init: function()
	{
		this.timeStore = new Array();
		
		var idleService = Components.classes["@mozilla.org/widget/idleservice;1"]
                  .getService(Components.interfaces.nsIIdleService);
		idleService.addIdleObserver(this, this.idleTrigger);		//at two minutes idle, we get called.
		
		window.setTimeout (function (obj) {obj.registerForEvents();}, 500, this);
	},
	
	uninit: function()
	{
		var idleService = Components.classes["@mozilla.org/widget/idleservice;1"]
					.getService(Components.interfaces.nsIIdleService);
		idleService.removeIdleObserver(this, this.idleTrigger);		//remove idle observer on sianara
		
		this.completeRecord("PageUnload");							//finshes any ongoing log
		this.unregisterForEvents()
		return;
	},
	registerForEvents: function()
	{
		gBrowser.tabContainer.addEventListener('TabSelect', this, false);
		gURLBar.addEventListener('ValueChange', this, true);		
	},
    
	unregisterForEvents: function()
	{
		gBrowser.tabContainer.removeEventListener('TabSelect', this, false);
		gURLBar.removeEventListener('ValueChange', this, true);
	},    
	
	startRecord: function(trigger) {
	
		this.window_loc = gBrowser.selectedBrowser.currentURI.spec;
		this.window_title = gBrowser.selectedBrowser.contentTitle;
		this.start_trigger = trigger;
		this.started = getUnixTime(new Date);
		this.completed = "";
	},	
	
	
	completeRecord: function(trigger) {
		if ( this.hasRecord() && this.window_loc != "about:blank") {
        //this.window_title = gBrowser.selectedBrowser.contentTitle;
		this.completed = getUnixTime(new Date);
		this.record_trigger = trigger;  
		this.logEntry();
		}

	},
	
	hasRecord: function() {
		return (this.window_title != "undefined");
	},	
 
 	clearRecord: function() {
		this.window_title = "undefined";
		this.window_loc="";
		this.start_trigger="";
		this.record_trigger="";
		this.started="";
		this.completed="";
	},

	logEntry: function () { 
		if ( this.hasRecord() ) {
            // AMR: log the start event==> note window_title will have spaces, so " " is not a good delimeter.
            objectID = elf.oHeaderInfo.nextObjectID;
            elf.oHeaderInfo.nextObjectID++;
            var currTime = new Date;
            elf.oHeaderInfo.events[objectID] =
                new elf.EventObject(getUnixTime(currTime), elf.oHeaderInfo.windowID, objectID, this.window_loc, "MTAB_VIEW_TIME");
            elf.oHeaderInfo.events[objectID].mAddTabTimeData(this.started, this.completed, this.window_title);
        }		
	},

	handleEvent: function (event) {
		switch (event.type) {
		  case "TabSelect":
		  case "ValueChange":
			//check if the selected tab is the one with the ongoing record
			//we could test/set this.lastSelected with gBrowser.selectedTab, but we care about URL more.
			//I think both fire for a new selection, with ValueChange first, perhaps. But when the URI's are
			//the same, we just return with no need for completion.
			//if(mTabTime.window_title == window.content.location.href){
			if(this.window_loc == gBrowser.selectedBrowser.currentURI.spec){
				return;
			}
			else{
				this.completeRecord(event.type);
				this.clearRecord();
				this.startRecord(event.type);
			}
			break;
		} 
	},
  
  	observe : function(aSubject, aTopic, aData) {
		if (aTopic == "idle") {
			this.completeRecord(aTopic);
			this.clearRecord();
			return;
		}
		
		if (aTopic == "back"){
			this.startRecord(aTopic);
			return;		
		}
		
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
    }
    return 0;
  },
  
 /****************************************************************************
 * Link target finder
 ****************************************************************************/
  linkTargetFinder: function (browsercontent) {return;}, // AMR: this is not used in data collection
  
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
  
  //AMR:each event now associated with personal ids
  if (arguments.length==8)
  {
    this.u_id1 = arguments[5];          //AMR: if caller passed credentials, such as reloading from log
    this.u_id2 = arguments[6];
    this.user_site = arguments[7];
  }
  else                                  //otherwise, read it from the common module.
  {
    this.u_id1 = elf.commonCred.user_id1;
    this.u_id2 = elf.commonCred.user_id2;
    this.user_site = elf.commonCred.user_site;
  }
  
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
    }
  },
  
  //AMR: mais add data to an mTabTime event. start time and end time given
  mAddTabTimeData:function(mTabStart, mTabStop, mTabTitle){
    var timeString= mTabStart + "|_|" + mTabStop + "|_|" + mTabTitle;
    this.addRow(timeString + "\r\n");
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
    data += this.eventCode + " ";
    data += this.u_id1 + " ";           //AMR: We need to remove all spaces in IDs. Its used as delimeter
    data += this.u_id2 + " ";
    data += this.user_site + "\r\n";
    data += this.getData();
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
  this.experimentPhase = this.getIntPref(this.lpref, "experimentPhase", 1); // AMR:data collection
  this.version = 0.2; // needs to match the one in the install.rdf
}
elf.HeaderInfo.prototype =
{
  rows: 0,
  LOGSERVER: elf.updateServer,
  
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
      const id = elf.appId;
      var extension = Components.classes["@mozilla.org/extensions/manager;1"]
      .getService(Components.interfaces.nsIExtensionManager)
      .getInstallLocation(id)
      .getItemLocation(id);
      
      // netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");
      
      // create proper path for xml file
      var uncommittedLogFile = extension.path + "\\" + "uncommitted.log";
      // create component for file writing
      var file = Components.classes["@mozilla.org/file/local;1"]
	        .createInstance(Components.interfaces.nsILocalFile);
      file.initWithPath( uncommittedLogFile );
      //alert("creating file... " + uncommittedLogFile);
      if(file.exists() == false) //check to see if file exists
      {
        file.create( Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 420);
      }
      
      // create file output stream and use write/create/truncate mode
      // 0x02 writing, 0x08 create file, 0x20 truncate length if exist JJJ: changed to append 0x10
      // AMR: appending helps when user opens multiple windows and we write several times
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
      const id = elf.appId;
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
      var stream = Components.classes["@mozilla.org/network/file-input-stream;1"]
	        .createInstance(Components.interfaces.nsIFileInputStream);
      stream.init(file, 0x01, 0444, null);
      
      var sstream = Components.classes["@mozilla.org/scriptableinputstream;1"]
	        .createInstance(Components.interfaces.nsIScriptableInputStream);
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
        if(line.length > 0) {       //AMR: the separator is an empty line with nothing on it. We start new entry there.
          if(initEntry == false) {
            initEntry = true;
            // parse the line
            chunks = line.split(" ");
            if(chunks.length == 8) {
              reqTime = parseInt(chunks[0]);
              reqWindowID = parseInt(chunks[1]);
              reqID = parseInt(chunks[2]);
              reqURL = chunks[3];
              reqOp = chunks[4];
              reqUserId1 = chunks[5];
              reqUserId2 = chunks[6];
              reqUserSite = chunks[7];
                         
              this.oldevents[reqID] = new elf.EventObject(reqTime, reqWindowID, reqID, reqURL, reqOp, reqUserId1, reqUserId2, reqUserSite);
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
              alert("Error != 8 chunks: " + line);
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
      
      // delete the file after loading it AMR: we can write everything back again
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
    if(name.indexOf(this.LOGSERVER + "/lastrequestid?MACHINEID=") == 0) //startswith
    {
      // do nothing
      return;
    }
    if(name.indexOf(this.LOGSERVER + "/log?MACHINEID=") == 0) //startswith
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
    if(name.indexOf(this.LOGSERVER + "/lastrequestid?MACHINEID=") === 0) //startswith
    {
      // do nothing
      return;
    }
    if(name.indexOf(this.LOGSERVER + "/log?MACHINEID=") === 0) //startswith
    {
      // do nothing
      return;
    }
    
	/* AMR: no cache modification needed now
    // modify the expiration time of the response
    var currDate = new Date;
    var currTime = getUnixTime(currDate);  
    var newExpirationTime = currTime + 1800; // 30 minutes expiration time extension // 31536000; 1 hour extension
    var expirationDate = new Date(newExpirationTime * 1000);
    oHttp.setResponseHeader("Expires", expirationDate.toString(), false);
    oHttp.setResponseHeader("Cache-Control", "max-age=31536000", false);
	*/
    
    // Get the response headers
    var visitor = new elf.HeaderInfoVisitor(oHttp);
    var headers = visitor.visitResponse();
    
    // Get the EventObject
    var currTime = new Date;
    var currObjectID = this.nextObjectID++;
    this.events[currObjectID] = new elf.EventObject(getUnixTime(currTime), this.windowID, currObjectID, name, "RESPONSE");
    var reqObj = this.events[currObjectID];
    reqObj.addHeaders(headers);
  },

  onExamineCachedResponse : function (oHttp)
  {
    var name = oHttp.URI.asciiSpec;
    //var origname = oHttp.originalURI.asciiSpec;
    
    // ignore server communication request/responses
    if(name.indexOf(this.LOGSERVER + "/lastrequestid?MACHINEID=") === 0) //startswith
    {
      // do nothing
      return;
    }
    if(name.indexOf(this.LOGSERVER + "/log?MACHINEID=") === 0) //startswith
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
    reqObj.addHeaders(headers);
  },
  
  addMovedLocation: function(originalURL, movedLocation) {
    this.movedLocationMap[originalURL] =  movedLocation;
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
var PrefetchService = Components.classes["@mozilla.org/prefetch-service;1"]
						.getService(Components.interfaces.nsIPrefetchService);
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


function ff_makeURI(b){
    return Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService).newURI(b,null,null)
}

// add a prefetch link to the queue
function queuePrefetchLink(url, referer, tag, depth) {
  prefetchLinkQueue[prefetchLinkQueue.length++] = new PrefetchObject(url, referer, tag, depth, 0);
}

function requeuePrefetchLinks() { return;}		//AMR:not used in data collection

function readCachedFile(url) { return "";}      //AMR:not used in data collection

function isParseable(contentType) {
  if (contentType.indexOf("htm") > -1 ||
      contentType.indexOf("asp") > -1) {
    return true;
  }
  return false;
}


function doPrefetch(t, s){ return;}			//AMR: not used

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

/****************************************************************************
 * Cache size setting and getting methods
 ****************************************************************************/
function set_cache_settings() {
  var pref_service = Components.classes["@mozilla.org/preferences-service;1"]
      .getService(Components.interfaces.nsIPrefService);
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

  if ( type == 'disk' ) {
    // log this
    objectID = elf.oHeaderInfo.nextObjectID;
    elf.oHeaderInfo.nextObjectID++;
    var currTime = new Date;
    elf.oHeaderInfo.events[objectID] =
      new elf.EventObject(getUnixTime(currTime), elf.oHeaderInfo.windowID, objectID, current.toString(), "CACHE_SIZE");
  }
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
  if(Finished){  }
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
    setTimeout("updateTimer()", elf.updateEvery);   //AMR: updates the server every N minutes
  }
}

function checkIfOnline(myObject){
  prefsService = Components.classes["@mozilla.org/preferences-service;1"]
         .getService(Components.interfaces.nsIPrefBranch);
  ioService = Components.classes["@mozilla.org/network/io-service;1"]
         .getService(Components.interfaces.nsIIOService2);

  if(!Finished){
    var client = new XMLHttpRequest();
    var objectPointer = elf.oHeaderInfo;
    
    client.onreadystatechange = function()
    { 
      if(client.readyState == 4)
      {
        isOffline = prefsService.getBoolPref("browser.offline");
        if(client.status == 200) {

        }
        else {
          // set offline
          if(!isOffline) {
            ioService.offline = true;
            prefsService.setBoolPref('browser.offline', true);
          }
        }
      }
    };

    client.open("HEAD", "http://www.google.com", true); 
    client.send(null);
    
    setTimeout("checkIfOnline()", 60000);				//AMR:Check if online every M minutes
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
  prefsService = Components.classes["@mozilla.org/preferences-service;1"]
           .getService(Components.interfaces.nsIPrefBranch);
  prefsService.setBoolPref('browser.offline', false);
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

    return this.headers;
  },
  visitResponse : function ()
  {
    var ver = this.getHttpResponseVersion();
    this.headers = new Array();
    this.headers["RESPONSE"] = "HTTP/" + ver + " " + this.oHttp.responseStatus 
                    + " " + this.oHttp.responseStatusText;
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

#!/usr/bin/env python
import sys, os
import string,cgi,time
from BaseHTTPServer import BaseHTTPRequestHandler, HTTPServer
import pickle
import time
import pdb
# need python 3.02 i think for urllib
from urlparse import urlparse

experiment_phase = '1'

#parse_qsl needs python 2.6
def parse_params(query):
    params = {}
    #pdb.set_trace()
    chunks = query.split('&')
    for chunk in chunks:
        p = chunk.split('=')
        params[p[0]] = p[1]
    return params

nextMachineID = 0
ackedEventIDs = {}
eventEntries = {}

class RequestEntry():
    def __init__(self, sourceaddr, version, machineID, timestamp, windowID, eventID, URL, eventCode, clockSkew):
        self.sourceaddr = sourceaddr
        self.version = version 
        self.machineID = machineID
        self.timestamp = timestamp 
        self.windowID = windowID
        self.eventID = eventID 
        self.URL = URL
        self.eventCode = eventCode 
        self.clockSkew = clockSkew

        #self.reqHeaders = [];
        self.headers = [];
    def get_header(self, headerkey):
        for header in self.headers:
            if header.find(headerkey) > -1:
                return header[len(headerkey)+1:].strip()
        return None
    # XXX: ignore duplicates untested
    def add_header(self, header):
        # get the header's key
        headerkey = ""
        #headerchunks = header.split(':')
        #if len(headerchunks) > 1:
        #    headerkey = headerchunks[0]
        #else:
        #    # JJJ: first line of header can have no key
        #    pass
        #    # if the key cannot be found, ignore the add header 
        #    # return
        ## if the key already exists, ignore the duplicate add header 
        #if self.get_header(headerkey):
        #    return

        # add the header
        self.headers.append(header + "\r\n")
    def get_string(self):
        data = str(self.timestamp) + " " + self.sourceaddr + " " + str(self.machineID) + " " + str(self.windowID) + " " + str(self.eventID) + " " + self.URL + " " + self.eventCode + "\r\n"
        for header in self.headers:
            data = data + header
        data = data + "\r\n"
        return data

class MyHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        global ackedEventIDs
        global nextMachineID 
        global experiment_phase
        try:
            #print str(time.time()) + " " + self.path
            #print str(time.time()) + " " + self.headers

            # parse the request
            o = urlparse(self.path)
            if not o.path == '/lastrequestid':
                #pdb.set_trace()
                self.send_error(404,'File Not Found: %s' % self.path)
                return
            params = parse_params(o.query)
            sourceaddr = self.address_string()
            machineID = int(params['MACHINEID'])
            windowID = int(params['WINDOWID'])
            clientVersion = float(params['VERSION'])

            # check & assign machineID
            if machineID == -1:
              machineID = nextMachineID
              nextMachineID = nextMachineID + 1

            # XXX: move to separate function and mutex this
            # lookup the request ID for the source address
            eventID = -1
            if ackedEventIDs.has_key((machineID, windowID)):
              eventID = ackedEventIDs[(machineID, windowID)]
            else:            
              ackedEventIDs[(machineID, windowID)] = eventID

            # return the info to the source
            self.send_response(200)
            self.send_header('Content-type',	'text/html')
            self.end_headers()
            self.wfile.write(str(machineID) + ' ' + str(eventID) + ' ' + str(experiment_phase))
            print str(time.time()) + ' (' + str(sourceaddr) + ', ' + str(machineID) + ', ' +  str(windowID) + ', ' + str(clientVersion) + ') -> [' + str(eventID) + "]"
        except IOError:
            self.send_error(404,'File Not Found: %s' % self.path)
        finally:
            self.connection.close()
            pass


    # goes through all the data, parses into RequestEntry objects and inserts them into the big dict
    def parse_data(self, sourceaddr, version, machineID, windowID, data, clockSkew):
        global ackedEventIDs
        global eventEntries 
        # chop the data into chunk entires based on the \r\n's
        receivedEventEntries = 0
        receivedRequestEntries = 0
        receivedResponseEntries = 0
        initEntry = False 
        currentEntry = None
        for line in data.split('\r\n'):
            #print line
            try:
                if len(line.strip()) > 0:
                    # create and initialize the entry
                    if initEntry == False:
                        initEntry = True
                        chunks = line.split()
                        if len(chunks) == 5:
                            timestamp = int(chunks[0])
                            windowID = int(chunks[1]) 
                            eventID = int(chunks[2])
                            URL = chunks[3]
                            eventCode = chunks[4]

                            currentEntry = RequestEntry(sourceaddr, version, machineID, timestamp, windowID, eventID, URL, eventCode, clockSkew)
                            #print currentEntry.get_string()
                            #pdb.set_trace()
                            if eventCode == "REQUEST":
                                receivedRequestEntries = receivedRequestEntries + 1
                            elif (eventCode == "RESPONSE") or (eventCode == "CACHED"):
                                receivedResponseEntries = receivedResponseEntries + 1
                            else:
                                receivedEventEntries = receivedEventEntries + 1
                        else:
                            # something is wrong with the initial line 
                            print "Error: " + line
                            #pdb.set_trace()
                            pass
                    # add to the existing entry
                    else:
                        currentEntry.add_header(line)
                else:
                    # save the old entry
                    if currentEntry is not None:
                        eventEntries[(machineID, windowID, currentEntry.eventID)] = currentEntry
                    # make new entry
                    initEntry = False
            except:
                print "Error: " + str(line) + "\n"
                #pdb.set_trace()
        return (receivedRequestEntries, receivedResponseEntries, receivedEventEntries)
                
    # returns the request IDs for a particular window
    def get_eventIDs(self, machineID, windowID):
        global eventEntries 
        eventIDs = []
        for entry in eventEntries.values():
            if entry.windowID == windowID:
                if entry.machineID == machineID:
                    eventIDs.append(entry.eventID)
        # sort them for free
        eventIDs.sort(lambda x,y: y-x)
        return eventIDs
            
    def do_POST(self):
        global ackedEventIDs
        global eventEntries 
        #global rootnode
        try:
            #print str(time.time()) + " " + self.path
            #print str(time.time()) + " " + self.headers

            #pdb.set_trace()
            o = urlparse(self.path)
            if not o.path == '/log':
                return
            params = parse_params(o.query)
            #sourceaddr = params['SOURCEADDR']
            sourceaddr = self.address_string()
            machineID = int(params['MACHINEID'])
            windowID = int(params['WINDOWID'])
            clientVersion = float(params['VERSION'])
            clientTime = int(params['LOCALTIME'])
            clockSkew = time.time() - clientTime

            ctype, pdict = cgi.parse_header(self.headers.getheader('content-type'))
            length = int(self.headers.getheader('content-length'))
            if ctype == 'text/plain':#;charset=UTF-8':
            #if ctype == 'application/x-www-form-urlencoded':
                # grab the data and parse it
                data = self.rfile.read(length)
                (receivedRequestEntries, receivedResponseEntries, receivedEventEntries) = self.parse_data(sourceaddr, clientVersion, machineID, windowID, data, clockSkew)

                #pdb.set_trace()
                # get and update the last ack'd eventID
                lastAckedID = ackedEventIDs[(machineID, windowID)]
                eventIDs = self.get_eventIDs(machineID, windowID)
                if len(eventIDs) > 0:
                    lastAckedID = eventIDs[0]
                    ackedEventIDs[(machineID, windowID)] = lastAckedID
                
                # return OK response
                self.send_response(301)
                self.end_headers()
                self.wfile.write("<text>UPLOAD COMPLETE.</text>")

                # log stuff
                logmsg = str(time.time()) + " (" + sourceaddr + ", " + str(machineID) + ", " + str(windowID) + ") [" + str(receivedRequestEntries) + ", " + str(receivedResponseEntries) + ", " + str(receivedEventEntries) + "] -> [" + str(lastAckedID) + "]" + "\n"
                print logmsg
                debuglog = open('debug.log', 'a')
                debuglog.write(logmsg)
                debuglog.close()
    
                # save data to file
                datalog = open('data.log', 'a')
                datalog.write("[" + str(time.time()) + " " + sourceaddr + " " + str(machineID) + " " + str(windowID) + " " + str(clientVersion) + " " + str(clientTime) + "]\r\n")
                datalog.write(data)
                datalog.close()
            else:
                debuglog = open('debug.log', 'a')
                debuglog.write(str(time.time()) + " " + sourceaddr + ": " + "bad upload: " + str(self.headers) + "\n")
                debuglog.close()
                print "bad upload: " + str(self.headers) + "\n"
        except:
            print "Error: " + str(self.headers) + "\n"
            #pdb.set_trace()

# save db
def save_db(filename, db):
  dumpfile = open(filename, 'w')
  pickle.dump(db, dumpfile)
  dumpfile.close()

def main():
    global nextMachineID 
    global ackedEventIDs
    global eventEntries 
    try:
        server = HTTPServer(('', 8081), MyHandler)
        print 'searching for previous state'
        # load dbs
        if os.path.isfile("ackedEventIDs.pickle") and os.path.isfile("eventEntries.pickle"):
            print 'previous state found!'
            print 'restoring state...'
            infp = open("ackedEventIDs.pickle")
            ackedEventIDs = pickle.load(infp)
            infp.close()
            infp = open("eventEntries.pickle")
            eventEntries = pickle.load(infp)
            infp.close()
            nextMachineID = 0
            for entry in eventEntries.values():
                if nextMachineID <= entry.machineID:
                    nextMachineID = entry.machineID + 1
                print entry.get_string()
        else:
            print 'no previous state found'
        print 'started httpserver...'
        server.serve_forever()
    except KeyboardInterrupt:
        print '^C received, shutting down server'
        server.socket.close()
    print 'saving state...'
    save_db("ackedEventIDs.pickle", ackedEventIDs)
    save_db("eventEntries.pickle", eventEntries)
    print 'state saved'
if __name__ == '__main__':
    main()


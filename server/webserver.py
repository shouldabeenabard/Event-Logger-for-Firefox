#!/usr/bin/env python
import sys, os
import string,cgi,time
from BaseHTTPServer import BaseHTTPRequestHandler, HTTPServer
from SocketServer import ThreadingMixIn
import threading
import pickle
import random
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

class RequestEntry():
    def __init__(self, sourceaddr, version, machineID, timestamp, windowID, eventID, URL, eventCode, user_id1, user_id2, user_site, clockSkew):
        self.sourceaddr = sourceaddr
        self.version = version 
        self.machineID = machineID
        self.timestamp = timestamp 
        self.windowID = windowID
        self.eventID = eventID 
        self.URL = URL
        self.eventCode = eventCode 
        self.user_id1 = user_id1
        self.user_id2 = user_id2
        self.user_site = user_site
        self.clockSkew = clockSkew

        #self.reqHeaders = [];
        self.headers = [];                  #AMR: this could also be mTimeTabs start/stop/window information
    def get_header(self, headerkey):
        for header in self.headers:
            if header.find(headerkey) > -1:
                return header[len(headerkey)+1:].strip()
        return None
    # XXX: ignore duplicates untested
    def add_header(self, header):
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
        # chop the data into chunk entires based on the \r\n's
        receivedEventEntries = 0
        receivedRequestEntries = 0
        receivedResponseEntries = 0
        initEntry = False 
        currentEntry = None
        parsedEntries = {}
        biggestEventID = -2;
        for line in data.split('\r\n'):
            #print line
            try:
                if len(line.strip()) > 0:
                    # create and initialize the entry
                    if initEntry == False:
                        initEntry = True
                        chunks = line.split()
                        if len(chunks) == 8:
                            timestamp = int(chunks[0])
                            windowID = int(chunks[1]) 
                            eventID = int(chunks[2])
                            URL = chunks[3]
                            eventCode = chunks[4]
                            user_id1 = chunks[5]
                            user_id2 = chunks[6]
                            user_site = chunks[7]

                            currentEntry = RequestEntry(sourceaddr, version, machineID, timestamp, windowID, eventID, URL, eventCode, user_id1, user_id2, user_site, clockSkew)
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
                    # save the old entry #AMR: Quit this, save to a temporary dictionary, return it
                    if currentEntry is not None:
                        parsedEntries[(machineID, windowID, currentEntry.eventID)] = currentEntry
                        if (currentEntry.eventID > biggestEventID):
                            biggestEventID = currentEntry.eventID
                        currentEntry = None
                    # make new entry
                    initEntry = False
            except:
                print "Error: " + str(line) + "\n"
                #pdb.set_trace()
        return (parsedEntries, biggestEventID, receivedRequestEntries, receivedResponseEntries, receivedEventEntries)
                           
    def do_POST(self):
        global ackedEventIDs
        
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
                (parsedEntries, biggestEventID, receivedRequestEntries, receivedResponseEntries, receivedEventEntries) = self.parse_data(sourceaddr, clientVersion, machineID, windowID, data, clockSkew)

                #pdb.set_trace()
                # get and update the last ack'd eventID
                # AMR: for the (machineID, windowID) key, if the current eventID is greater, then update it
                lastAckedID = ackedEventIDs.get((machineID, windowID),-1)
                if (biggestEventID > lastAckedID):
                    ackedEventIDs[(machineID, windowID)] = biggestEventID
                    
                #AMR: then write the data out to file
                try:
                    save_posted_events(parsedEntries)
                except:
                    print "ERROR 2: Problem writing postedEnteries to file"
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

# save temp dict
def save_posted_events(toSaveDict):
    save_dir = "pickles/"
    if not os.path.exists(save_dir):
        os.makedirs(save_dir)
    filename = str(int(time.time())) + "_" + str(random.randint(10,99)) + ".pickle"
    dumpfile = open(save_dir + filename, 'w')
    pickle.dump(toSaveDict, dumpfile)
    dumpfile.close()
    
# save db    
def save_db(filename, db):
  dumpfile = open(filename, 'w')
  pickle.dump(db, dumpfile)
  dumpfile.close()
  
class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    """Handle requests in a separate thread."""  

def main():
    global nextMachineID 
    global ackedEventIDs
    
    try:
        server = ThreadedHTTPServer(('', 80), MyHandler)  #AMR: need to think about mutex for shared vars
        print 'searching for previous state'
        # load dbs
        if os.path.isfile("ackedEventIDs.pickle") and os.path.isfile("nextMachineID.pickle"):
            print 'previous state found!'
            print 'restoring state...'
            infp = open("ackedEventIDs.pickle")
            ackedEventIDs = pickle.load(infp)
            infp.close()
            infp = open("nextMachineID.pickle")
            nextMachineID = pickle.load(infp)
            print "Next machine ID is " + str(nextMachineID)
            print "Last ACKeD IDs \n"
            print str(ackedEventIDs)
            infp.close()
        else:
            print 'no previous state found'
        print 'started httpserver...'
        server.serve_forever()
    except KeyboardInterrupt:
        print '^C received, shutting down server'
        server.socket.close()
    print 'saving state...'
    save_db("ackedEventIDs.pickle", ackedEventIDs)
    save_db("nextMachineID.pickle", nextMachineID)
    print 'state saved'
if __name__ == '__main__':
    main()


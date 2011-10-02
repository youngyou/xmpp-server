var xmpp = require('node-xmpp');
var ltx = require('ltx');

// http://xmpp.org/extensions/xep-0160.html
exports.name = "presence";

function Presence(client) {
    client.initial_presence_sent = false;
    
    client.on('inStanza', function(stz) {
        var stanza = ltx.parse(stz.toString());
        if (stanza.is('presence')) {
            // Ok, now we must do things =)
            if ((!stanza.attrs.to || stanza.attrs.to === client.server.options.domain) && !stanza.attrs.type) {
                // Section 5.1.1 in http://xmpp.org/rfcs/rfc3921.html#presence
                if(!client.initial_presence_sent) {
                    client.initial_presence_sent = true;
                    if(client.roster) {
                        client.roster.eachSubscription(["to", "both"], function(item) {
                            stanza.attrs.type = "probe";
                            stanza.attrs.to = item.jid;
                            client.server.emit('inStanza', stanza); // TODO: Blocking Outbound Presence Notifications.
                        });
                        client.roster.subscriptions(["from", "both"], function(jids) {
                            jids.forEach(function(jid) {
                                stanza.attrs.to = jid;
                                client.server.emit('inStanza', stanza); // TODO: Blocking Outbound Presence Notifications.
                            });
                        });
                    }
                    // Send the presence to the other resources for this jid, if any.
                    client.server.connectedClientsForJid(stanza.attrs.from).forEach(function(jid) {
                        if(client.jid.resource != jid.resource) {
                            stanza.attrs.to = jid.toString();
                            client.server.emit('inStanza', stanza); // TODO: Blocking Outbound Presence Notifications.
                        }
                    })
                }
                // Section 5.1.2 in http://xmpp.org/rfcs/rfc3921.html#presence
                if((!stanza.attrs.type || stanza.attrs.type === "unavailable") && client.initial_presence_sent) {
                    if(client.roster) {
                        client.roster.subscriptions(["from", "both"], function(jids) {
                            jids.forEach(function(jid) {
                                stanza.attrs.to = jid;
                                client.server.emit('inStanza', stanza); // TODO: Blocking Outbound Presence Notifications.
                            });
                        });
                    }
                }
            }
        }
    });

    client.on('outStanza', function(stz) {
        // Section 5.1.3 in http://xmpp.org/rfcs/rfc3921.html#presence
        // TODO : HANDLE THINGS WHENE THE CLIENT IS OFFLINE TOO!
        var stanza = ltx.parse(stz.toString());
        if (stanza.is('presence')) {
            if(stanza.attrs.type === "probe") {
                if(client.roster) {
                    RosterItem.find(client.roster, new xmpp.JID(stanza.attrs.from), function(item) {
                        console.log("----");
                        console.log(item);
                    });
                }
            }
        }
    });
    
    client.on('disconnect', function() {
        // We need to send a <presence type="offline" > on his behalf
        var stanza = new xmpp.Element('presence', {from: client.jid.toString(), type: "unavailable" });
        client.server.connectedClientsForJid(client.jid.toString()).forEach(function(jid) {
            if(client.jid.resource != jid.resource) {
                stanza.attrs.to = jid.toString();
                client.emit('outStanza', stanza); // TODO: Blocking Outbound Presence Notifications.
            }
        });
    });
    
}

exports.mod = Presence;
exports.configure = function(c2s, s2s) {
    c2s.on("recipient_offline", function(stanza) {
        if(stanza.is("presence")) {
            console.log("PRESENCE FOR OFFLINE USER!");
            console.log(stanza.toString());
        }
    });
}


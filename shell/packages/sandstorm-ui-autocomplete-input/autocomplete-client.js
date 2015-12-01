Template.contactInputBox.onCreated(function () {
  var self = this;
  this.currentText = new ReactiveVar(null);
  this.inputActive = new ReactiveVar(false);
  this.selectedContacts = this.data.contacts;
  this.selectedContactsIds = new ReactiveVar([]);
  this.highlightedContact = new ReactiveVar({_id: null});
  this.subscribe("userContacts");
  this.randomId = Random.id();  // For use with aria requiring ids in html
  this.autoCompleteContacts = new ReactiveVar([]);
  this.autorun(generateAutoCompleteContacts.bind(this, this));
  this.autorun(function () {
    var selectedContactId = self.highlightedContact.get()._id;
    var filterFunc = function (contact) {
      return contact._id === selectedContactId;
    }
    var contacts = self.autoCompleteContacts.get();
    if (contacts.length > 0 && (!selectedContactId || !_.find(contacts, filterFunc))) {
      var nonDefault = _.find(contacts, function (contact) { return !contact.isDefault; });
      if (nonDefault) {
        self.highlightedContact.set(nonDefault);
      } else {
        self.highlightedContact.set(contacts[0]);
      }
    }
  });
});

function generateAutoCompleteContacts(template) {
  var currentText = template.currentText.get();
  if (!currentText) {
    template.autoCompleteContacts.set([]);
    template.highlightedContact.set({_id: null});
    return;
  }
  // TODO(someday): handle defaults for google/github/etc
  var defaults = [];
  if (currentText.indexOf("@") > 0) { // we also want to ignore starting with an @ symbol
    defaults.push({
      _id: "defaultEmail",
      profile: {
        name: currentText,
        service: "email",
        intrinsicName: "Email address"
      },
      isDefault: true,
    });
  }
  currentText = currentText.toLowerCase();
  var selectedContactsIds = template.selectedContactsIds.get();
  var contacts = globalDb.collections.contacts.find({_id: {$nin: selectedContactsIds}}).fetch();
  var results;
  if (currentText.lastIndexOf("@", 0) === 0) {
    var textWithoutAt = currentText.slice(1);
    results = _.filter(contacts, function (contact) {
      return contact.profile.handle.toLowerCase().indexOf(textWithoutAt) !== -1;
    });
  } else {
    results = _.filter(contacts, function (contact) {
      return contact.profile.name.toLowerCase().indexOf(currentText) !== -1 ||
        contact.profile.handle.toLowerCase().indexOf(currentText) !== -1 ||
        contact.profile.intrinsicName.toLowerCase().indexOf(currentText) !== -1;
    });
  }
  results.forEach(function (contact) {
    var oldId = contact._id;
    contact._id = contact.identityId;
    SandstormDb.fillInPictureUrl(contact);
    contact._id = oldId;
  })
  template.autoCompleteContacts.set(defaults.concat(results));
};

Template.contactInputBox.helpers({
  completedContacts: function () {
    return Template.instance().selectedContacts.get();
  },
  autoCompleteContacts: function () {
    return Template.instance().autoCompleteContacts.get();
  },
  inputActive: function () {
    return Template.instance().inputActive.get();
  },
  isCurrentlySelected: function () {
    var selectedContactId = Template.instance().highlightedContact.get()._id;

    return selectedContactId === this._id;
  },
  templateId: function () {
    return Template.instance().randomId;
  }
});

function selectContact(template, highlightedContact, inputBox) {
  if (highlightedContact.isDefault) {
    if (highlightedContact.profile.service === "email") {
      highlightedContact._id = inputBox.value;
      highlightedContact.profile.name = inputBox.value;
      highlightedContact.profile.pictureUrl = "/email.svg";
    }
  }
  var contacts = template.selectedContacts.get();
  contacts.push(highlightedContact);
  template.selectedContacts.set(contacts);

  var selectedContactsIds = template.selectedContactsIds.get();
  selectedContactsIds.push(highlightedContact._id);
  template.selectedContactsIds.set(selectedContactsIds);

  template.highlightedContact.set({_id: null});
  inputBox.value = "";
  template.currentText.set(null);
}
function deleteSelected(contact, template) {
  var self = contact;
  var contacts = template.selectedContacts.get();
  template.selectedContacts.set(_.filter(contacts, function (contact) {
    return contact._id !== self._id;
  }));

  var selectedContactsIds = template.selectedContactsIds.get();
  template.selectedContactsIds.set(_.filter(selectedContactsIds, function (id) {
    return id !== self._id;
  }));
  template.find("input").focus();
}

Template.contactInputBox.events({
  // "click .contact-box": function (event) {
  //   var input = event.currentTarget.getElementsByTagName("input")[0];
  //   input.focus();
  // },
  "input input": function (event, template) {
    template.currentText.set(event.target.value);
  },
  "keydown .completed-contact": function (event, template) {
    if (event.keyCode === 8) { // Backspace
      deleteSelected(this, template);
      return false;
    }
  },
  "click .closer": function (event, template) {
    deleteSelected(this, template);
    return false;
  },
  "keyup input": function (event, template) {
    if (event.keyCode === 8) { // Backspace
      if (!event.target.value) {
        template.find(".completed-contacts>li:last-child").focus();
        return false;
      }
    }
  },
  "keydown input": function(event, template) {
    if (event.keyCode === 38) { // Up
      var contactId = template.highlightedContact.get()._id;
      var contacts = template.autoCompleteContacts.get();
      var ids = _.pluck(contacts, "_id");
      var index = ids.indexOf(contactId);
      var newContact = null;
      if (index >= 0) {
        if (index === 0) {
          newContact = contacts[contacts.length - 1];
        } else {
          newContact = contacts[index - 1];
        }
      } else if (contacts.length > 0) {
        newContact = contacts[0];
      }
      // TODO(someday): call scrollintoview on the now highlighted contact
      template.highlightedContact.set(newContact);
      return false;
    } else if (event.keyCode === 40) { // Down
      var contactId = template.highlightedContact.get()._id;
      var contacts = template.autoCompleteContacts.get();
      var ids = _.pluck(contacts, "_id");
      var index = ids.indexOf(contactId);
      var newContact = null;
      if (index >= 0) {
        if (index + 1 >= contacts.length) {
          newContact = contacts[0];
        } else {
          newContact = contacts[index + 1];
        }
      } else if (contacts.length > 0) {
        newContact = contacts[contacts.length - 1];
      }
      template.highlightedContact.set(newContact);
      return false;
    } else if (event.keyCode === 13) { // Enter
      var highlightedContact = template.highlightedContact.get();
      if (highlightedContact._id) {
        selectContact(template, highlightedContact, event.target);
      }
      return false;
    }
  },
  "focus input": function(event, template) {
    template.inputActive.set(true);
  },
  "blur input": function(event, template) {
    template.inputActive.set(false);
  },
  "mousedown .autocomplete, click .autocomplete": function(event, template) {
    selectContact(template, this, template.find("input"));
    template.find("input").focus();

    return false;
  },
});

const SUCCESS_MESSAGE_DELAY = 1000;
const AUTH_STATE_DELAY = 1000;
const LOADING_SCREEN_DELAY = 500;
const LOGGING_ENABLED = false;

let App = {
  user: null,
  userData: {},
  stagedDataForDatabase: {},

  signup: function(data) {
    this.stagedDataForDatabase = {
      'practitioner-type': data['practitioner-type']
    }
    firebase.auth().createUserWithEmailAndPassword(data.email, data.password)
      .catch(this.displayError.bind(this));
  },
  signin: function(data) {
    let persistence;
    if (data.checkbox) {
      persistence = firebase.auth.Auth.Persistence.LOCAL;
    } else {
      persistence = firebase.auth.Auth.Persistence.SESSION;
    }
    firebase.auth().setPersistence(persistence)
      .then(function() {
        firebase.auth().signInWithEmailAndPassword(data.email, data.password)
        .catch(this.displayError.bind(this));
      }.bind(this))
      .catch(this.displayError.bind(this));
  },

  signout: function() {
    firebase.auth().signOut();
    redirectToHome();
  },
  displayError: function(error) {
    this.$success.toggle(false);
    this.$error.text(error.message || error).toggle(true);
  },
  displaySuccess: function(message) {
    this.$error.toggle(false);
    this.$success.text(message).toggle(true);
  },
  isProfilePage: function() {
    return (location.pathname === "/profile");
  },
  isAccountSettingsPage: function() {
    return (location.pathname === "/customize-alerts");
  },
  isSigninPage: function() {
    return !!this.signinForm;
  },
  isSignupPage: function() {
    return !!this.signupForm;
  },

  updateUserDataLocal: function(data) {
    log('Adding the following to user\'s local data store...');
    log(data);
    Object.keys(data).forEach(function(key) {
      let value = data[key];
      this.userData[key] = value;
    }.bind(this));
    this.loadPageData();
  },

  putFileInStorage: function(file, callback) {
    let storageRef = firebase.storage().ref();
    let path = `avatars/${this.user.uid}`;
    let avatarRef = storageRef.child(path);
    avatarRef.put(file).then(function(snapshot) {
      avatarRef.getDownloadURL().then(function(url) {
        this.putDataInDatabase({photoURL: url}, callback);
      }.bind(this)).catch(logError);
    }.bind(this)).catch(logError);
  },
  putDataInDatabase: function(data, callback) {
    this.updateUserDataLocal(data);
    let dbRef = firebase.database().ref('users/' + this.user.uid);
    log('Updating database with the following data...');
    log(this.userData);
    dbRef.set(this.userData, function(error) {
      if (error) {
        logError(error);
      } else if (callback) {
        callback();
      }
    }.bind(this));
  },
  waitOnDatabaseTransfer: function() {

  },
  getDataFromDatabaseAndLoadPageData: function() {
    let dbRef = firebase.database().ref('users/' + this.user.uid);
    dbRef.once('value').then(function(snapshot) {
      this.userData = snapshot.val() || {};
      this.pullNameAndPhotoFromFirebaseProfile();
      this.loadPageData();
    }.bind(this)).catch(logError);
  },

  pullNameAndPhotoFromFirebaseProfile() {
    let data = this.userData,
        user = this.user;
    
    if (!data['first-name'] && !data['last-name'] && user.displayName) {
      let names = user.displayName.split(' ');
      data['first-name'] = names.shift();
      data['last-name'] = names.join(' ');
    }
    if (!data.photoURL) {
      data.photoURL = user.photoURL;
    }
    if (!data['contact-email']) {
      data['contact-email'] = user.email;
    }
  },

  setAuthStateListener: function() {
    firebase.auth().onAuthStateChanged(function(user) {
      this.user = user;
      if (Object.keys(this.stagedDataForDatabase).length !== 0) {
        let data = this.stagedDataForDatabase;
        this.stagedDataForDatabase = {};
        this.putDataInDatabase(data, this.handleAuthState.bind(this));
      } else {
        this.handleAuthState();
      }
    }.bind(this));
  },
  handleAuthState: function() {
    if (this.user) {
      this.toggleNavWhenUserLoggedIn();
      this.getDataFromDatabaseAndLoadPageData();
    } else {
      this.toggleNavWhenUserLoggedOut();
    }
    this.authGuard();
  },
  hideLoadingScreen: function() {
    setTimeout(function() {
      scrollToTop();
      this.$loadingScreenTop.animate(
        {top: -window.innerHeight},
        LOADING_SCREEN_DELAY,
        function() {
          this.$loadingScreenTop.toggle(false);
        }.bind(this)
      );
      this.$loadingScreenBottom.animate(
        {top: window.innerHeight},
        LOADING_SCREEN_DELAY,
        function() {
          this.$loadingScreenBottom.toggle(false);
        }.bind(this)
      );
    }.bind(this), 0);
  },
  authGuard: function() {
    if ((this.isSigninPage() || this.isSignupPage()) && this.user) {
      redirectToProfile();
    } else if (this.isProfilePage() && !this.user) {
      redirectToHome();
    }
  },
  toggleNavWhenUserLoggedIn: function() {
    this.$navLoginButton.toggle(false);
    this.$navProfileButton.toggle(true);
  },
  toggleNavWhenUserLoggedOut: function() {
    this.$navProfileButton.toggle(false);
    this.$navLoginButton.toggle(true);
  },
  setProfileNavName: function() {
    this.$navProfileButton.text(this.userData['first-name'] || 'Profile');
  },

  loadPageData: function() {
    this.setProfileNavName();
    if (this.isProfilePage()) {
      this.loadProfileNav();
      this.loadProfileHeader();
      this.loadProfileAbout();
      this.loadProfileEdit();
    } else if (this.isAccountSettingsPage()) {
      this.loadProfileNav();
      this.loadAccountInfo();
    }
    this.hideLoadingScreen();
  },
  loadProfileNav: function() {
    this.loadNavAvatar();
    this.loadNavName();
  },
  loadProfileHeader: function() {
    let data = this.userData;
    let firstName = data['first-name'] || '';
    let lastName = data['last-name'] || '';
    let displayName = (firstName + ' ' + lastName).trim();
    let headerText = displayName ? `Hello there, ${displayName}` : 'Hello there!';
    this.$welcomeHeading.text(headerText);
    this.$usernameHeader.text(displayName);
    this.loadAvatar();
  },
  loadProfileAbout: function() {
    let data = this.userData;
    Object.keys(this.userData).forEach(function(key) {
      let value = data[key];
      let element = document.getElementById('about-' + key);
      if (element && value) {
        element.textContent = value;
      }
    });
  },
  loadProfileEdit: function() {
    let data = this.userData;
    Object.keys(data).forEach(function(key) {
      let value = data[key];
      let element = document.getElementById('edit-' + key);
      if (element && value) {
        element.value = value;
      }
    });
  },
  loadAvatar: function() {
    let data = this.userData;
    if (data) {
      this.$userAvatar.attr('src', data.photoURL);
    }
  },
  loadNavAvatar: function() {
    let photoURL = this.userData.photoURL;
    if (photoURL) {
      this.$profileAvatarButton.css({
        'background-image': 'url(' + photoURL + ')',
        'background-position': 'center',
      });
    } else {
      this.$profileAvatarButton.toggle(false);
    }
  },
  loadNavName: function() {
    let name = this.userData['first-name'];
    if (name) {
      this.$profileNameButton.text(name);
    }
  },
  loadAccountInfo: function() {
    this.$accountEmail.text(this.user.email);
  },

  bindElements: function() {
    // nav
    this.$navLoginButton = $('#nav-login-button');
    this.$navProfileButton = $('#nav-profile-button');

    // signup/signin general
    this.$formError = $('#form-error-message').toggle(false);

    // generic
    this.$error = $('.error-message');
    this.$success = $('.success-message');

    // sign up
    this.signupForm = document.getElementById('signupForm');
    this.$signupAgreeToTermsCheckbox = $('#sigupCheckbox');

    // sign in
    this.signinForm = document.getElementById('signinForm');
    this.$signinGoogleButton = $('#signin-google-button');
    this.$signinRememberMeCheckbox = $('#signinCheckbox');
    this.$forgotPasswordLink = $('#forgotPasswordLink');

    // profile general
    this.$profileAvatarButton = $('#profile-avatar-button');
    this.$profileNameButton = $('#profile-name-button');
    this.$welcomeHeading = $('#welcome-heading');
    this.$backgroundHeaderImage = $('#background-header-image');
    this.$editBackgroundImageButton =$('#edit-background-image');
    this.$userAvatar = $('#user-avatar');
    this.$usernameHeader = $('#username-header');
    this.$loadingScreenTop = $('#loading-screen-top');
    this.$loadingScreenBottom = $('#loading-screen-bottom');
    this.$signoutButton = $('.link-logout');

    // profile about
    this.$aboutPhone = $('#about-phone');
    this.$aboutContactEmail = $('#about-contact-email');
    this.$aboutLocation = $('#about-location');
    this.$aboutPosition = $('#about-position');
    this.$aboutBio = $('#about-bio');

    // profile edit
    this.$avatarForm = $('#avatar-form');
    this.$editProfileForm = $('#wf-form-profile');
    this.$editPhotoUpload = $('#photo-upload');
    this.$editFirstName = $('#edit-first-name');
    this.$editLastName = $('#edit-last-name');
    this.$editLocation = $('#edit-location');
    this.$editContactEmail = $('#edit-contact-email');
    this.$editPhone = $('#edit-phone');
    this.$editFacebookUrl = $('#edit-facebook-url');
    this.$editInstagramUrl = $('#edit-instagram-url');
    this.$editTwitterUrl = $('#edit-twitter-url');
    this.$editBio = $('#edit-bio');

    // account
    this.$changeEmailButton = $('#change-email-button');
    this.$changeEmailModal = $('#email-modal');
    this.$changeEmailForm = $('#email-modal-form');
    this.$accountEmail = $('#account-email');
    this.$resetPassword = $('#account-reset-password-link');
    this.$resetPasswordModal = $('#reset-password-modal');
    this.$resetPasswordForm = $('#reset-password-modal-form');
    this.$updatePasswordForm = $('#update-password-form');
    this.$deleteAccountButton = $('#delete-account-button');
    this.$deleteAccountModal = $('#delete-account-modal');
    this.$deleteAccountConfirm = $('#delete-account-confirm-button');
  },
  bindEventListeners: function() {
    if (this.isSignupPage()) {
      this.signupForm.addEventListener('submit', this.handleSignup.bind(this), true);
    } else if (this.isSigninPage()) {
      this.signinForm.addEventListener('submit', this.handleSignin.bind(this), true);
      this.$signinGoogleButton.click(this.handleGoogleSignin.bind(this));
      this.$forgotPasswordLink.click(this.handleForgotPasswordReset.bind(this));
    } else if (this.isProfilePage()) {
      this.$avatarForm.submit(this.handleAvatarUpload.bind(this));
      this.$editProfileForm.submit(this.handleProfileEdit.bind(this));
    } else if (this.isAccountSettingsPage()) {
      this.$changeEmailButton.click(this.showChangeEmailModal.bind(this));
      this.$changeEmailForm.get(0).addEventListener('submit', this.handleEmailChange.bind(this), true);
      this.$resetPassword.click(this.showResetPasswordModal.bind(this));
      this.$resetPasswordForm.submit(this.handleAccountPasswordReset.bind(this));
      this.$updatePasswordForm.get(0).addEventListener('submit', this.handleUpdatePassword.bind(this), true);
      this.$deleteAccountButton.click(this.showDeleteAccountModal.bind(this));
      this.$deleteAccountConfirm.click(this.handleDeleteAccount.bind(this))
    }
    this.$signoutButton.click(this.handleSignout.bind(this));
  },

  showChangeEmailModal: function() {
    this.$changeEmailModal.attr('style', '').fadeIn();
  },
  handleEmailChange: function(event) {
    event.preventDefault();
    event.stopPropagation();
    let newEmail = this.$changeEmailForm.find('#name-3').val();
    let password = this.$changeEmailForm.find('#name-4').val();
    let credentials = firebase.auth.EmailAuthProvider.credential(this.user.email, password);
    this.$success = this.$changeEmailForm.siblings('.success-message');
    this.$error = this.$changeEmailForm.siblings('.error-message');

    this.user.reauthenticateWithCredential(credentials)
      .then(function() {
        this.user.updateEmail(newEmail)
        .then(function() {
          this.displaySuccess('Your email address has been updated to ' + newEmail);
          setTimeout(function() {
            this.$changeEmailModal.fadeOut();
            this.$changeEmailForm.get(0).reset();
            this.$accountEmail.text(newEmail);
          }.bind(this), SUCCESS_MESSAGE_DELAY);
        }.bind(this))
        .catch(this.displayError.bind(this));
      }.bind(this))
      .catch(this.displayError.bind(this));
  },
  showResetPasswordModal: function(event) {
    event.preventDefault();
    this.$resetPasswordModal.attr('style', '').fadeIn();
  },
  handleAccountPasswordReset: function(event) {
    let email = $('#password-reset-email').val();
    this.$success = this.$resetPasswordForm.siblings('.success-message');
    this.$error = this.$resetPasswordForm.siblings('.error-message');

    firebase.auth().sendPasswordResetEmail(email)
      .then(function() {
        this.displaySuccess('Password reset email sent to ' + email);
        setTimeout(function() {
          this.$resetPasswordModal.toggle(false);
          this.$resetPasswordForm.toggle().get(0).reset();
          this.$success.toggle(false);
        }.bind(this), SUCCESS_MESSAGE_DELAY);
      }.bind(this))
      .catch(this.displayError.bind(this));
  },
  handleUpdatePassword: function(event) {
    event.preventDefault();
    event.stopPropagation();
    let currentPassword = $('#current-password').val();
    let newPassword = $('#new-password').val();
    let repeatPassword = $('#repeat-password').val();
    let credentials = firebase.auth.EmailAuthProvider.credential(this.user.email, currentPassword);
    this.$success = this.$updatePasswordForm.siblings('.success-message');
    this.$error = this.$updatePasswordForm.siblings('.error-message');

    if (newPassword === repeatPassword) {
      this.user.reauthenticateWithCredential(credentials)
      .then(function() {
        this.user.updatePassword(newPassword)
        .then(function() {
          this.$updatePasswordForm.get(0).reset();
          this.displaySuccess('Your password has been updated.');
          setTimeout(function() {
            this.$success.toggle(false);
          }.bind(this), SUCCESS_MESSAGE_DELAY);
        }.bind(this))
        .catch(this.displayError.bind(this));
      }.bind(this))
      .catch(this.displayError.bind(this));
    } else {
      this.displayError('Passwords do not match.');
    }
  },
  handleForgotPasswordReset: function() {
    let email = $('#email').val();
    if (email) {
      firebase.auth().sendPasswordResetEmail(email)
        .then(function() {
          this.displaySuccess('Password reset email sent to ' + email);
        }.bind(this))
        .catch(this.displayError.bind(this));
    } else {
      this.displayError("Please enter your email address above and click link again.");
    }
  },
  showDeleteAccountModal: function() {
    this.$deleteAccountModal.attr('style', '').fadeIn();
  },
  handleDeleteAccount: function() {
    this.user.delete().then(function() {
      redirectToHome();
    }).catch(logError);
  },
  handleSignout: function(event) {
    event.preventDefault();
    this.signout();
  },
  handleSignup: function(event) {
    event.preventDefault();
    event.stopPropagation();
    let form = event.currentTarget;
    let data = getFormData(form);
    this.signup(data);
  },
  handleSignin: function(event) {
    event.preventDefault();
    event.stopPropagation();
    let form = event.currentTarget;
    let data = getFormData(form);
    this.signin(data);
  },
  handleGoogleSignin: function(event) {
    event.preventDefault();
    this.signinGoogle();
  },
  handleAvatarUpload: function(event) {
    event.preventDefault();
    let form = event.currentTarget;
    this.$success = $(form).siblings('.success-message');
    this.$error = $(form).siblings('.error-message');
    let data = getFormData(form);
    let file = data['photo-upload'];
    this.putFileInStorage(file);
  },
  handleProfileEdit: function(event) {
    event.preventDefault();
    let form = event.currentTarget;
    let data = getFormData(form);
    this.$success = $(form).siblings('.success-message');
    this.$error = $(form).siblings('.error-message');
    this.putDataInDatabase(data, function() {
      setTimeout(function() {
        this.$success.toggle(false);
        $(form).toggle(true);
        scrollToTop();
      }.bind(this), SUCCESS_MESSAGE_DELAY);
    }.bind(this));
  },

  init: function() {
    this.bindElements();
    this.bindEventListeners();
    this.setAuthStateListener();
    return this;
  },
};

$(function() {
  window.app = App.init();
});

function redirect(path) {
  if (location.pathname !== path) {
    log('redirecting from ' + location.pathname + ' to ' + path);
    location.pathname = path;
  }
}

function redirectToHome() {
  redirect('/');
}

function redirectToProfile() {
  redirect('profile/user-profile');
}

function log(message) {
  if (LOGGING_ENABLED) {
    console.log(message);
  }
}

function logError(error) {
  if (error.code && error.message) {
    console.error('Error code: ' + error.code);
    console.error('Error message: ' + error.message);
  } else {
    console.error(error);
  }
}

function scrollToTop() {
  window.scrollTo(0, 0);
}

function getFormData(form) {
  let formData = new FormData(form);
  let data = {};
  for (var pair of formData.entries()) {
    let key = pair[0],
        value = pair[1];
    data[key] = value;
  }
  return data;
}
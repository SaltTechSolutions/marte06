"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.respondToGuardian = exports.requestGuardian = exports.GUARDIAN_CONSENT_VERSION = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const push_1 = require("./push");
/**
 * Parent–child links for under-18 members (MEMBER-5b).
 *
 * Both operations are callables rather than security rules for the same
 * reason: each one has to LOOK SOMETHING UP. Finding the parent by e-mail is a
 * query over the roster, which rules cannot run and which a plain member is
 * deliberately not allowed to list. And the consent record has to be stamped
 * with a server timestamp the child cannot choose.
 */
/** The consent text the parent is agreeing to. Bumped whenever the wording
 *  changes, so an old record still says which version was accepted. */
exports.GUARDIAN_CONSENT_VERSION = '2026-08-31.v1';
function requireUid(request) {
    var _a;
    const uid = (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', 'Giriş yapmış olmanız gerekiyor.');
    return uid;
}
/**
 * A member (in practice a minor) nominates a parent by e-mail.
 *
 * The parent must already be a member of the same gym — decision 1 makes them
 * a real member, not a free-text contact, because they will be paying and
 * booking. If they are not, the child is told to have them join first; we do
 * not create an account on someone else's behalf.
 */
exports.requestGuardian = (0, https_1.onCall)({ region: 'europe-west1' }, async (request) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    const uid = requireUid(request);
    const tenantId = String((_b = (_a = request.data) === null || _a === void 0 ? void 0 : _a.tenantId) !== null && _b !== void 0 ? _b : '');
    const email = String((_d = (_c = request.data) === null || _c === void 0 ? void 0 : _c.guardianEmail) !== null && _d !== void 0 ? _d : '').trim().toLowerCase();
    if (!tenantId || !email) {
        throw new https_1.HttpsError('invalid-argument', 'Salon ve ebeveyn e-postası gerekiyor.');
    }
    const db = admin.firestore();
    const childRef = db.doc(`tenant_memberships/${tenantId}_${uid}`);
    const childSnap = await childRef.get();
    if (!childSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Bu salonda üyeliğin bulunamadı.');
    }
    const child = childSnap.data();
    if (String((_e = child.userEmail) !== null && _e !== void 0 ? _e : '').toLowerCase() === email) {
        throw new https_1.HttpsError('invalid-argument', 'Kendini ebeveyn olarak seçemezsin.');
    }
    const matches = await db
        .collection('tenant_memberships')
        .where('tenantId', '==', tenantId)
        .where('userEmail', '==', email)
        .limit(2)
        .get();
    const guardianDoc = matches.docs.find((d) => d.data().status === 'active');
    if (!guardianDoc) {
        throw new https_1.HttpsError('not-found', 'Bu e-postayla salonda aktif bir üye bulunamadı. Ebeveynin önce salona üye olmalı.');
    }
    const guardian = guardianDoc.data();
    // A child cannot be their own grandparent: if the nominated parent is
    // themselves a minor linked to someone, the chain is almost certainly a
    // mistake. Rejecting it here is cheaper than untangling it later.
    if (guardian.guardianId) {
        throw new https_1.HttpsError('failed-precondition', 'Seçtiğin üye kendisi bir ebeveyne bağlı. Lütfen yetişkin bir üye seç.');
    }
    await childRef.update({
        guardianId: guardian.userId,
        guardianName: (_g = (_f = guardian.userDisplayName) !== null && _f !== void 0 ? _f : guardian.userEmail) !== null && _g !== void 0 ? _g : '',
        guardianStatus: 'pending',
        // A re-request after a rejection must not carry the old consent forward.
        guardianConsentAt: admin.firestore.FieldValue.delete(),
        guardianConsentVersion: admin.firestore.FieldValue.delete(),
    });
    await (0, push_1.sendPushToUser)(guardian.userId, 'Ebeveyn onayı isteniyor', `${(_j = (_h = child.userDisplayName) !== null && _h !== void 0 ? _h : child.userEmail) !== null && _j !== void 0 ? _j : 'Bir üye'} seni ebeveyni olarak gösterdi.`, { screen: '/member/guardian-requests' });
    return { guardianName: (_l = (_k = guardian.userDisplayName) !== null && _k !== void 0 ? _k : guardian.userEmail) !== null && _l !== void 0 ? _l : '' };
});
/**
 * The parent answers. Approving records the consent (KVKK): when, by whom,
 * against which version of the text.
 *
 * The child's own `status` is untouched — the gym still has to approve them
 * separately, and that gate is enforced in the rules.
 */
exports.respondToGuardian = (0, https_1.onCall)({ region: 'europe-west1' }, async (request) => {
    var _a, _b, _c, _d, _e;
    const uid = requireUid(request);
    const tenantId = String((_b = (_a = request.data) === null || _a === void 0 ? void 0 : _a.tenantId) !== null && _b !== void 0 ? _b : '');
    const childId = String((_d = (_c = request.data) === null || _c === void 0 ? void 0 : _c.childId) !== null && _d !== void 0 ? _d : '');
    const approve = ((_e = request.data) === null || _e === void 0 ? void 0 : _e.approve) === true;
    if (!tenantId || !childId) {
        throw new https_1.HttpsError('invalid-argument', 'Salon ve üye bilgisi gerekiyor.');
    }
    const db = admin.firestore();
    const childRef = db.doc(`tenant_memberships/${tenantId}_${childId}`);
    const childSnap = await childRef.get();
    if (!childSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Üye bulunamadı.');
    }
    const child = childSnap.data();
    if (child.guardianId !== uid) {
        throw new https_1.HttpsError('permission-denied', 'Bu istek sana ait değil.');
    }
    if (child.guardianStatus !== 'pending') {
        throw new https_1.HttpsError('failed-precondition', 'Bu istek zaten yanıtlanmış.');
    }
    if (approve) {
        await childRef.update({
            guardianStatus: 'approved',
            guardianConsentAt: admin.firestore.FieldValue.serverTimestamp(),
            guardianConsentVersion: exports.GUARDIAN_CONSENT_VERSION,
        });
    }
    else {
        // The link is cleared, not left as 'rejected' with a guardianId: leaving
        // it would keep granting that person read access to the child's record.
        await childRef.update({
            guardianId: admin.firestore.FieldValue.delete(),
            guardianName: admin.firestore.FieldValue.delete(),
            guardianStatus: 'rejected',
        });
    }
    await (0, push_1.sendPushToUser)(child.userId, approve ? 'Ebeveyn onayın alındı' : 'Ebeveyn onayı verilmedi', approve
        ? 'Kaydın salon yöneticisinin onayını bekliyor.'
        : 'Gösterdiğin ebeveyn onay vermedi. Başka bir ebeveyn seçebilirsin.', { screen: '/member/edit-profile' });
    return { approved: approve };
});
//# sourceMappingURL=guardians.js.map
#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, token, Address, Env, String};

// ─── Test Helpers ─────────────────────────────────────────────────────────────

struct TestCtx {
    env: Env,
    contract_id: Address,
    admin: Address,
    client: Address,
    freelancer: Address,
    token_id: Address,
    job_id: String,
    milestone_id: String,
}

impl TestCtx {
    fn new() -> Self {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(FreelanceEscrow, ());

        let token_admin = Address::generate(&env);
        let token_id = env
            .register_stellar_asset_contract_v2(token_admin.clone())
            .address();

        let admin = Address::generate(&env);
        let client = Address::generate(&env);
        let freelancer = Address::generate(&env);

        // Mint 1_000_000_000 stroops to client
        let token_admin_client = token::StellarAssetClient::new(&env, &token_id);
        token_admin_client.mint(&client, &1_000_000_000i128);

        let api = FreelanceEscrowClient::new(&env, &contract_id);
        api.initialize(&admin, &250u32);

        let job_id = String::from_str(&env, "job_001");
        let milestone_id = String::from_str(&env, "ms_001");

        TestCtx {
            env,
            contract_id,
            admin,
            client,
            freelancer,
            token_id,
            job_id,
            milestone_id,
        }
    }

    fn api(&self) -> FreelanceEscrowClient {
        FreelanceEscrowClient::new(&self.env, &self.contract_id)
    }

    fn create_default_job(&self) {
        self.api().create_job(
            &self.job_id,
            &self.client,
            &self.freelancer,
            &10_000_000i128,
            &self.token_id,
        );
    }
}

// ─── Initialize ───────────────────────────────────────────────────────────────

#[test]
fn test_initialize_success() {
    let ctx = TestCtx::new();
    assert_eq!(ctx.api().get_fee(), 250);
    assert_eq!(ctx.api().get_admin(), ctx.admin);
}

#[test]
#[should_panic]
fn test_initialize_twice_fails() {
    let ctx = TestCtx::new();
    // Second call should panic with AlreadyInitialized
    ctx.api().initialize(&ctx.admin, &100u32);
}

// ─── Create Job ───────────────────────────────────────────────────────────────

#[test]
fn test_create_job_success() {
    let ctx = TestCtx::new();
    ctx.create_default_job();

    let job = ctx.api().get_job(&ctx.job_id);
    assert_eq!(job.client, ctx.client);
    assert_eq!(job.freelancer, ctx.freelancer);
    assert_eq!(job.total_amount, 10_000_000);
    assert_eq!(job.funded_amount, 0);
    assert_eq!(job.fee_basis_points_snapshot, 250);
    assert_eq!(job.status, JobStatus::Open);
    assert_eq!(job.milestone.status, MilestoneStatus::Pending);
}

#[test]
#[should_panic]
fn test_create_job_duplicate_fails() {
    let ctx = TestCtx::new();
    ctx.create_default_job();
    // Second create with same job_id should panic with JobAlreadyExists
    ctx.api().create_job(
        &ctx.job_id,
        &ctx.client,
        &ctx.freelancer,
        &10_000_000i128,
        &ctx.token_id,
    );
}

// ─── Fund Job ─────────────────────────────────────────────────────────────────

#[test]
fn test_fund_job_success() {
    let ctx = TestCtx::new();
    ctx.create_default_job();

    ctx.api()
        .fund_job(&ctx.job_id, &ctx.client, &10_000_000i128);

    let job = ctx.api().get_job(&ctx.job_id);
    assert_eq!(job.status, JobStatus::Funded);
    assert_eq!(job.funded_amount, 10_000_000);

    // Contract should hold the escrowed tokens
    let token = token::Client::new(&ctx.env, &ctx.token_id);
    assert_eq!(token.balance(&ctx.contract_id), 10_000_000);
}

#[test]
#[should_panic]
fn test_fund_job_wrong_caller_fails() {
    let ctx = TestCtx::new();
    ctx.create_default_job();
    let stranger = Address::generate(&ctx.env);
    ctx.api().fund_job(&ctx.job_id, &stranger, &10_000_000i128);
}

#[test]
#[should_panic]
fn test_fund_job_wrong_amount_fails() {
    let ctx = TestCtx::new();
    ctx.create_default_job();
    ctx.api().fund_job(&ctx.job_id, &ctx.client, &5_000_000i128);
}

#[test]
#[should_panic]
fn test_fund_job_wrong_status_fails() {
    let ctx = TestCtx::new();
    ctx.create_default_job();
    ctx.api()
        .fund_job(&ctx.job_id, &ctx.client, &10_000_000i128);
    // Try to fund again — should panic with InvalidJobStatus
    ctx.api()
        .fund_job(&ctx.job_id, &ctx.client, &10_000_000i128);
}

// ─── Submit Milestone ─────────────────────────────────────────────────────────

#[test]
fn test_submit_milestone_success() {
    let ctx = TestCtx::new();
    ctx.create_default_job();
    ctx.api()
        .fund_job(&ctx.job_id, &ctx.client, &10_000_000i128);
    ctx.api()
        .submit_milestone(&ctx.job_id, &ctx.milestone_id, &ctx.freelancer);

    let job = ctx.api().get_job(&ctx.job_id);
    assert_eq!(job.status, JobStatus::InProgress);
    assert_eq!(job.milestone.status, MilestoneStatus::Submitted);
}

#[test]
#[should_panic]
fn test_submit_milestone_wrong_caller_fails() {
    let ctx = TestCtx::new();
    ctx.create_default_job();
    ctx.api()
        .fund_job(&ctx.job_id, &ctx.client, &10_000_000i128);
    let stranger = Address::generate(&ctx.env);
    ctx.api()
        .submit_milestone(&ctx.job_id, &ctx.milestone_id, &stranger);
}

// ─── Approve Milestone ────────────────────────────────────────────────────────

#[test]
fn test_approve_milestone_success_and_fee_calculation() {
    let ctx = TestCtx::new();
    ctx.create_default_job();
    ctx.api()
        .fund_job(&ctx.job_id, &ctx.client, &10_000_000i128);
    ctx.api()
        .submit_milestone(&ctx.job_id, &ctx.milestone_id, &ctx.freelancer);

    let (net, fee) = ctx
        .api()
        .approve_milestone(&ctx.job_id, &ctx.milestone_id, &ctx.client);

    // 250 bps on 10_000_000 = 250_000 fee, 9_750_000 net
    assert_eq!(fee, 250_000);
    assert_eq!(net, 9_750_000);
    assert_eq!(net + fee, 10_000_000, "Conservation of funds violated");

    // Check token balances
    let token = token::Client::new(&ctx.env, &ctx.token_id);
    assert_eq!(token.balance(&ctx.freelancer), 9_750_000);
    assert_eq!(token.balance(&ctx.admin), 250_000);
    assert_eq!(token.balance(&ctx.contract_id), 0);

    let job = ctx.api().get_job(&ctx.job_id);
    assert_eq!(job.status, JobStatus::Completed);
    assert_eq!(job.milestone.status, MilestoneStatus::Approved);
}

#[test]
#[should_panic]
fn test_approve_milestone_wrong_caller_fails() {
    let ctx = TestCtx::new();
    ctx.create_default_job();
    ctx.api()
        .fund_job(&ctx.job_id, &ctx.client, &10_000_000i128);
    ctx.api()
        .submit_milestone(&ctx.job_id, &ctx.milestone_id, &ctx.freelancer);
    let stranger = Address::generate(&ctx.env);
    ctx.api()
        .approve_milestone(&ctx.job_id, &ctx.milestone_id, &stranger);
}

#[test]
#[should_panic]
fn test_approve_milestone_not_submitted_fails() {
    let ctx = TestCtx::new();
    ctx.create_default_job();
    ctx.api()
        .fund_job(&ctx.job_id, &ctx.client, &10_000_000i128);
    // Skip submit — should panic with InvalidMilestoneStatus
    ctx.api()
        .approve_milestone(&ctx.job_id, &ctx.milestone_id, &ctx.client);
}

// ─── Happy Path End-to-End ────────────────────────────────────────────────────

#[test]
fn test_full_happy_path() {
    let ctx = TestCtx::new();
    ctx.create_default_job();
    ctx.api()
        .fund_job(&ctx.job_id, &ctx.client, &10_000_000i128);
    ctx.api()
        .submit_milestone(&ctx.job_id, &ctx.milestone_id, &ctx.freelancer);
    let (net, fee) = ctx
        .api()
        .approve_milestone(&ctx.job_id, &ctx.milestone_id, &ctx.client);

    assert_eq!(net + fee, 10_000_000, "Conservation of funds violated");
    assert_eq!(fee, 250_000);
    assert_eq!(net, 9_750_000);
}

// ─── Fee Snapshot Immutability ────────────────────────────────────────────────

#[test]
fn test_fee_snapshot_is_immutable() {
    let ctx = TestCtx::new();
    ctx.create_default_job();

    // Admin changes fee rate to 500 bps after job creation
    ctx.api().update_platform_fee(&500u32);
    assert_eq!(ctx.api().get_fee(), 500);

    // In-flight job still uses the original 250 bps snapshot
    let job = ctx.api().get_job(&ctx.job_id);
    assert_eq!(job.fee_basis_points_snapshot, 250);
}

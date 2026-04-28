#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Env, String,
};

// ─── Storage Keys ────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Fee,
    Job(String),
}

// ─── Domain Types ─────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum JobStatus {
    Open,
    Funded,
    InProgress,
    Completed,
    Cancelled,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum MilestoneStatus {
    Pending,
    Submitted,
    Approved,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct MilestoneRecord {
    pub milestone_id: String,
    pub amount: i128,
    pub status: MilestoneStatus,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct JobRecord {
    pub job_id: String,
    pub client: Address,
    pub freelancer: Address,
    pub token_address: Address,
    pub total_amount: i128,
    pub funded_amount: i128,
    pub fee_basis_points_snapshot: u32,
    pub status: JobStatus,
    pub milestone: MilestoneRecord,
}

// ─── Errors ───────────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Clone, Debug, PartialEq)]
pub enum ContractError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    JobAlreadyExists = 3,
    JobNotFound = 4,
    MilestoneNotFound = 5,
    Unauthorized = 6,
    InvalidAmount = 7,
    InvalidJobStatus = 8,
    InvalidMilestoneStatus = 9,
}

// ─── Contract ─────────────────────────────────────────────────────────────────

#[contract]
pub struct FreelanceEscrow;

#[contractimpl]
impl FreelanceEscrow {
    // ── Initialize ────────────────────────────────────────────────────────────

    /// One-time setup. Must be called by the ops/platform account.
    pub fn initialize(
        env: Env,
        admin: Address,
        fee_basis_points: u32,
    ) -> Result<(), ContractError> {
        if env.storage().persistent().has(&DataKey::Admin) {
            return Err(ContractError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage()
            .persistent()
            .set(&DataKey::Fee, &fee_basis_points);
        Ok(())
    }

    // ── Admin: update platform fee ────────────────────────────────────────────

    /// Update global fee rate. Does NOT affect in-flight jobs.
    pub fn update_platform_fee(env: Env, new_fee: u32) -> Result<(), ContractError> {
        let admin: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotInitialized)?;
        admin.require_auth();
        env.storage().persistent().set(&DataKey::Fee, &new_fee);
        Ok(())
    }

    // ── Create Job ────────────────────────────────────────────────────────────

    /// Called by the platform ops account (server-side). Creates an escrow job.
    pub fn create_job(
        env: Env,
        job_id: String,
        client: Address,
        freelancer: Address,
        total_amount: i128,
        token_address: Address,
    ) -> Result<(), ContractError> {
        // Contract must be initialized and caller must be the admin (Ops account)
        let admin: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotInitialized)?;
        
        // Prevent unauthorized job creation and spoofing
        admin.require_auth();

        // Prevent duplicate job IDs
        if env
            .storage()
            .persistent()
            .has(&DataKey::Job(job_id.clone()))
        {
            return Err(ContractError::JobAlreadyExists);
        }

        // Snapshot fee at creation time — immutable for this job's lifetime
        let fee_snapshot: u32 = env.storage().persistent().get(&DataKey::Fee).unwrap_or(0);

        let milestone = MilestoneRecord {
            milestone_id: String::from_str(&env, "ms_001"),
            amount: total_amount,
            status: MilestoneStatus::Pending,
        };

        let job = JobRecord {
            job_id: job_id.clone(),
            client: client.clone(),
            freelancer: freelancer.clone(),
            token_address,
            total_amount,
            funded_amount: 0,
            fee_basis_points_snapshot: fee_snapshot,
            status: JobStatus::Open,
            milestone,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Job(job_id.clone()), &job);

        // Emit event
        env.events().publish(
            (symbol_short!("create"), job_id.clone()),
            (client, freelancer, total_amount, fee_snapshot),
        );

        Ok(())
    }

    // ── Fund Job ──────────────────────────────────────────────────────────────

    /// Called by the Client wallet (user-signed XDR).
    /// Transfers `amount` from client into the contract.
    pub fn fund_job(
        env: Env,
        job_id: String,
        caller: Address,
        amount: i128,
    ) -> Result<(), ContractError> {
        caller.require_auth();

        let mut job: JobRecord = env
            .storage()
            .persistent()
            .get(&DataKey::Job(job_id.clone()))
            .ok_or(ContractError::JobNotFound)?;

        if caller != job.client {
            return Err(ContractError::Unauthorized);
        }
        if job.status != JobStatus::Open {
            return Err(ContractError::InvalidJobStatus);
        }
        if amount != job.total_amount {
            return Err(ContractError::InvalidAmount);
        }

        // SEP-41 token transfer: client → contract
        let token_client = token::Client::new(&env, &job.token_address);
        token_client.transfer(&caller, &env.current_contract_address(), &amount);

        job.funded_amount = amount;
        job.status = JobStatus::Funded;
        env.storage()
            .persistent()
            .set(&DataKey::Job(job_id.clone()), &job);

        env.events()
            .publish((symbol_short!("fund"), job_id), (amount, caller));

        Ok(())
    }

    // ── Submit Milestone ──────────────────────────────────────────────────────

    /// Called by the Freelancer wallet (user-signed XDR).
    pub fn submit_milestone(
        env: Env,
        job_id: String,
        milestone_id: String,
        caller: Address,
    ) -> Result<(), ContractError> {
        caller.require_auth();

        let mut job: JobRecord = env
            .storage()
            .persistent()
            .get(&DataKey::Job(job_id.clone()))
            .ok_or(ContractError::JobNotFound)?;

        if caller != job.freelancer {
            return Err(ContractError::Unauthorized);
        }
        if job.status != JobStatus::Funded && job.status != JobStatus::InProgress {
            return Err(ContractError::InvalidJobStatus);
        }
        if job.milestone.milestone_id != milestone_id {
            return Err(ContractError::MilestoneNotFound);
        }
        if job.milestone.status != MilestoneStatus::Pending {
            return Err(ContractError::InvalidMilestoneStatus);
        }

        job.milestone.status = MilestoneStatus::Submitted;
        job.status = JobStatus::InProgress;
        env.storage()
            .persistent()
            .set(&DataKey::Job(job_id.clone()), &job);

        env.events()
            .publish((symbol_short!("submit"), job_id, milestone_id), (caller,));

        Ok(())
    }

    // ── Approve Milestone & Release Payment ───────────────────────────────────

    /// Called by the Client wallet (user-signed XDR).
    /// Transfers net amount to freelancer and fee to admin.
    pub fn approve_milestone(
        env: Env,
        job_id: String,
        milestone_id: String,
        caller: Address,
    ) -> Result<(i128, i128), ContractError> {
        caller.require_auth();

        let mut job: JobRecord = env
            .storage()
            .persistent()
            .get(&DataKey::Job(job_id.clone()))
            .ok_or(ContractError::JobNotFound)?;

        if caller != job.client {
            return Err(ContractError::Unauthorized);
        }
        if job.milestone.milestone_id != milestone_id {
            return Err(ContractError::MilestoneNotFound);
        }
        if job.milestone.status != MilestoneStatus::Submitted {
            return Err(ContractError::InvalidMilestoneStatus);
        }

        let admin: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotInitialized)?;

        // Fee calculation: floor(amount * bps / 10000)
        let milestone_amount = job.milestone.amount;
        let fee = milestone_amount * (job.fee_basis_points_snapshot as i128) / 10_000;
        let net = milestone_amount - fee;

        let token_client = token::Client::new(&env, &job.token_address);

        // Transfer net amount to freelancer
        token_client.transfer(&env.current_contract_address(), &job.freelancer, &net);

        // Transfer platform fee to admin
        if fee > 0 {
            token_client.transfer(&env.current_contract_address(), &admin, &fee);
        }

        job.milestone.status = MilestoneStatus::Approved;
        job.status = JobStatus::Completed;
        env.storage()
            .persistent()
            .set(&DataKey::Job(job_id.clone()), &job);

        env.events().publish(
            (symbol_short!("approve"), job_id, milestone_id),
            (net, fee, job.freelancer.clone()),
        );

        Ok((net, fee))
    }

    // ── Read-only ─────────────────────────────────────────────────────────────

    pub fn get_job(env: Env, job_id: String) -> Result<JobRecord, ContractError> {
        env.storage()
            .persistent()
            .get(&DataKey::Job(job_id))
            .ok_or(ContractError::JobNotFound)
    }

    pub fn get_fee(env: Env) -> u32 {
        env.storage().persistent().get(&DataKey::Fee).unwrap_or(0)
    }

    pub fn get_admin(env: Env) -> Result<Address, ContractError> {
        env.storage()
            .persistent()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotInitialized)
    }
}

mod test;

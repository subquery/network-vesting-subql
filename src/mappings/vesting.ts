import {
  AddVestingPlanEvent,
  VestingAllocatedEvent,
  VestingClaimed,
} from '@subql/contract-sdk/typechain/Vesting';
import { EthereumLog } from '@subql/types-ethereum';
import assert from 'assert';
import { VestingAllocation, VestingClaim, VestingPlan } from '../types';

export async function handleNewVestingPlan(
  event: EthereumLog<AddVestingPlanEvent['args']>
): Promise<void> {
  const handler = 'handleNewVestingPlan';
  logger.info(handler);
  assert(event.args, 'No event args');

  const { planId, lockPeriod, vestingPeriod, initialUnlockPercent } =
    event.args;
  const vestingPlan = VestingPlan.create({
    id: planId.toString(),
    lockPeriod: lockPeriod.toBigInt(),
    vestingPeriod: vestingPeriod.toBigInt(),
    initialUnlockPercentage: initialUnlockPercent.toBigInt(),
    totalAllocation: BigInt(0),
  });

  await vestingPlan.save();
}

export async function handleVestingAllocation(
  event: EthereumLog<VestingAllocatedEvent['args']>
): Promise<void> {
  const handler = 'handleVestingAllocation';
  logger.info(handler);
  assert(event.args, 'No event args');

  const { user, planId, allocation } = event.args;

  const vestingPlan = await VestingPlan.get(planId.toString());
  assert(vestingPlan, 'No vesting plan found');
  vestingPlan.totalAllocation =
    vestingPlan.totalAllocation + allocation.toBigInt();
  await vestingPlan.save();

  const vestingAllocation = VestingAllocation.create({
    id: user,
    planId: planId.toString(),
    amount: allocation.toBigInt(),
  });
  await vestingAllocation.save();
}

export async function handleVestingClaim(
  event: EthereumLog<VestingClaimed['args']>
): Promise<void> {
  const handler = 'handleVestingClaim';
  logger.info(handler);
  assert(event.args, 'No event args');

  const { user, amount } = event.args;

  const allocationRecord = await VestingAllocation.get(user);
  assert(allocationRecord, 'No allocation record found');

  const claimRecord = await VestingClaim.get(user);
  if (claimRecord) {
    claimRecord.totalClaimed = claimRecord.totalClaimed + amount.toBigInt();
    claimRecord.remainder = allocationRecord.amount - claimRecord.totalClaimed;
    await claimRecord.save();
  } else {
    const allocationRecord = await VestingAllocation.get(user);
    assert(allocationRecord, 'No allocation record found');
    const claim = VestingClaim.create({
      id: user,
      allocationId: user,
      totalClaimed: amount.toBigInt(),
      remainder: allocationRecord.amount - amount.toBigInt(),
    });
    await claim.save();
  }
}

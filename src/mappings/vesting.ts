// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import {
  VestingAllocatedEvent,
  VestingClaimedEvent,
  VestingPlanAddedEvent,
} from '@subql/contract-sdk/typechain/contracts/root/Vesting';
import { EthereumLog } from '@subql/types-ethereum';
import assert from 'assert';
import { VestingAllocation, VestingClaim, VestingPlan } from '../types';

function entityId(event: EthereumLog, suffix: string): string {
  return `${event.address}:${suffix}`;
}

export async function handleVestingPlanAdded(
  event: EthereumLog<VestingPlanAddedEvent['args']>
): Promise<void> {
  const handler = 'handleVestingPlanAdded';
  logger.info(handler);
  assert(event.args, 'No event args');

  const { planId, lockPeriod, vestingPeriod, initialUnlockPercent } =
    event.args;

  const vestingPlan = VestingPlan.create({
    id: entityId(event, planId.toString()),
    lockPeriod: lockPeriod.toBigInt(),
    vestingPeriod: vestingPeriod.toBigInt(),
    initialUnlockPercentage: initialUnlockPercent.toBigInt(),
    totalAllocation: BigInt(0),
  });

  await vestingPlan.save();
  logger.info(`Vesting plan added: ${planId.toString()}`);
}

export async function handleVestingAllocated(
  event: EthereumLog<VestingAllocatedEvent['args']>
): Promise<void> {
  const handler = 'handleVestingAllocated';
  logger.info(handler);
  assert(event.args, 'No event args');

  const { user, planId, allocation } = event.args;

  const vestingPlan = await VestingPlan.get(entityId(event, planId.toString()));
  assert(vestingPlan, 'No vesting plan found');
  vestingPlan.totalAllocation =
    vestingPlan.totalAllocation + allocation.toBigInt();
  await vestingPlan.save();

  const vestingAllocation = VestingAllocation.create({
    id: entityId(event, user),
    planId: entityId(event, planId.toString()),
    amount: allocation.toBigInt(),
  });
  await vestingAllocation.save();
  logger.info(`Vesting allocated to user: ${user}`);
}

export async function handleVestingClaimed(
  event: EthereumLog<VestingClaimedEvent['args']>
): Promise<void> {
  const handler = 'handleVestingClaimed';
  logger.info(handler);
  assert(event.args, 'No event args');

  const { user, amount, planId } = event.args;

  const allocationRecord = await VestingAllocation.get(user);
  assert(allocationRecord, 'No allocation record found');

  const claimRecord = await VestingClaim.get(user);
  if (claimRecord) {
    claimRecord.totalClaimed = claimRecord.totalClaimed + amount.toBigInt();
    claimRecord.remainder = allocationRecord.amount - claimRecord.totalClaimed;
    await claimRecord.save();
  } else {
    const claim = VestingClaim.create({
      id: entityId(event, user),
      planId: entityId(event, planId.toString()),
      allocationId: user,
      totalClaimed: amount.toBigInt(),
      remainder: allocationRecord.amount - amount.toBigInt(),
    });
    await claim.save();
  }
}
